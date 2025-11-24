from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from typing import List
import os
import json

import models, schemas, database
from openai_relay import router as openai_relay_router
from email_service import send_assessment_email
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# ===================================================================
# CRITICAL FIX: Move ALL late-binding imports to top level
# This prevents silent crashes on Python 3.13/Windows
# ===================================================================
from groq import AsyncGroq
from constitutional_ai import validate_story_synthesis, export_all_receipts
from review_queue import ReviewQueueManager, JourneyMode

load_dotenv()

# Create tables
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# Add CORS Middleware - MUST be added before routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins temporarily for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include OpenAI Relay Router
app.include_router(openai_relay_router)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Auth Configuration ---
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
        token_data = schemas.TokenData(email=email)
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.email == token_data.email).first()
    if user is None:
        raise credentials_exception
    return user

async def require_admin(current_user: models.User = Depends(get_current_user)):
    """Require user to have admin role"""
    if not hasattr(current_user, 'role') or current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

# --- API Endpoints ---

@app.post("/api/register", response_model=schemas.User)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user.password)
    new_user = models.User(email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/api/generate-report", response_model=schemas.Assessment)
async def generate_report(request: schemas.ReportRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Generate Report using Groq
    groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
    
    # Helper to normalize score to 0-100
    def get_score(dim_code):
        val = request.dimensions.get(dim_code, {}).get('score', 0)
        return val * 20 if val <= 5 else val

    prompt = f"""
    You are generating a S.C.O.P.E. FeedForward Report based on Danny Simms' S.C.O.P.E. FeedForward Model (7020TEN).

    This is a FUTURE-FOCUSED coaching report - use feedforward language (what TO DO), not feedback (what was wrong).

    Manager Email: {request.email}

    STRENGTHS OBSERVED:
    {', '.join(request.strengths) if request.strengths else 'Infer from conversation evidence below'}

    GROWTH OPPORTUNITIES:
    {', '.join(request.developmentPriorities) if request.developmentPriorities else 'Infer from conversation evidence below'}

    CONVERSATION EVIDENCE:
    {json.dumps(request.evidenceLog, indent=2)}

    SESSION SUMMARY: {request.summary}

    Generate a S.C.O.P.E. FeedForward Report in Markdown format with these sections:

    ## S.C.O.P.E. FeedForward Report
    *Future-Focused Coaching Conversation - Based on Danny Simms' S.C.O.P.E. FeedForward Model*

    ### S - Situation (Score: X/100)
    [Write a brief 1-2 sentence description of the coaching scenario based ONLY on conversation evidence. Do NOT include:
    - Specific times (Friday, 2pm, tomorrow, this week)
    - Specific locations (office, conference room)
    - Specific relationship terms (direct report, team member)
    - Any details not explicitly mentioned in the conversation
    Keep it general: "Preparing for a conversation about [topic from evidence]"]

    ### C - Choices (Score: X/100)
    [ONLY list choices explicitly discussed in conversation. If no choices were discussed, write "[No choices discussed yet]"]
    - **Choice A**: [From conversation or "[Not discussed]"]
    - **Choice B**: [From conversation or "[Not discussed]"]

    ### O - Outcomes (Score: X/100)
    [ONLY describe outcomes mentioned in conversation. If not discussed, write "[Outcomes not yet explored]"]
    - **If Choice A**: [From conversation or "[Not discussed]"]
    - **If Choice B**: [From conversation or "[Not discussed]"]

    ### P - Purpose (Score: X/100)
    [ONLY include purpose/values explicitly mentioned. If not discussed, write "[Purpose not yet explored]"]

    ### E - Engagement (Score: X/100)
    [ONLY include engagement/commitment discussed. If not discussed, write "[Engagement not yet discussed]"]

    ### Strengths
    [List 2-3 specific things the manager already does well - ALWAYS infer these from any evidence provided]

    ### Growth Opportunities
    [List 2-3 specific ways to strengthen the conversation - ALWAYS infer these from any evidence provided]

    ### Conversation Script
    [Provide a natural, flowing script the manager can use. Do NOT include specific times like "Friday", "tomorrow", "2pm" - keep it timeless: "When we meet..."]

    CRITICAL ANTI-HALLUCINATION RULES (FOLLOW STRICTLY):
    - ONLY use information explicitly in the CONVERSATION EVIDENCE above
    - NEVER invent or include:
      * Days/times (Monday, Friday, tomorrow, next week, 2pm, morning)
      * Locations (office, conference room, virtual meeting)
      * Relationships (direct report, team member) unless explicitly stated
      * People's names
      * Meeting types (1:1, performance review, project kickoff)
    - Use generic phrases instead:
      * "When you have this conversation..."
      * "The person you're coaching..."
      * "In your upcoming discussion..."

    IMPORTANT GUIDELINES:
    - Use future tense ("you will," "they can") - this is feedforward, not feedback
    - Score each component 0-100 based on specificity, clarity, and actionability
    - ALWAYS infer strengths and growth opportunities even from brief data
    - Keep language coaching-focused, professional, and growth-oriented
    - No medical, diagnostic, or academic jargon
    """
    
    try:
        print("🔄 Generating initial report...")
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,  # Low temperature to reduce hallucinations
            max_completion_tokens=2048
        )
        full_report = completion.choices[0].message.content
        print("✅ Initial report generated")
    except Exception as e:
        print(f"❌ Error generating report: {e}")
        full_report = "Report generation failed. Please contact support."

    # 1.5 HALLUCINATION VALIDATION - Second LLM validates the report
    validation_prompt = f"""You are an EXTREMELY strict fact-checker. Your job is to find and replace ALL fabricated details.

ORIGINAL CONVERSATION EVIDENCE (this is the ONLY source of truth):
{json.dumps(request.evidenceLog, indent=2)}

SESSION SUMMARY: {request.summary}

GENERATED REPORT TO CHECK:
{full_report}

STEP-BY-STEP VALIDATION:

1. CHECK THE SITUATION SECTION for these common hallucinations:
   - "one-on-one meeting" / "1:1" → Did user say this? If not → "[Meeting type not discussed]"
   - "this week" / "next week" / "tomorrow" / any day → Did user specify when? If not → "[Timing not discussed]"
   - "conference room" / "office" / any location → Did user specify where? If not → "[Location not discussed]"
   - "direct report" / "team member" / any relationship → Did user specify who? If not → "[Person not discussed]"
   - Any person's name → Did user mention this name? If not → "[Name not discussed]"

2. CHECK ALL OTHER SECTIONS for:
   - Specific meeting types (performance review, project kickoff, etc.)
   - Specific times (2pm, morning, etc.)
   - Specific days (Monday, Thursday, etc.)
   - Specific locations or room names
   - Specific relationship types not mentioned

3. REPLACEMENT RULES:
   - Replace "During your next one-on-one meeting this week" → "During your [timing not discussed] [meeting type not discussed]"
   - Replace "In the private conference room" → "In a [location not discussed]"
   - Replace "You and your direct report" → "You and [person not discussed]"
   - Any specific detail NOT in the evidence must be replaced with "[X not discussed]"

4. PRESERVE what IS in the evidence:
   - If user discussed "career transition to AI and instructional design" - KEEP IT
   - If user discussed specific choices or outcomes - KEEP THEM
   - Only replace what was NOT actually discussed

Return the COMPLETE corrected report in Markdown format with ALL hallucinations replaced."""

    try:
        print("🔄 Running hallucination validation...")
        validation = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": validation_prompt}],
            temperature=0.0,  # Zero temperature for strict validation
            max_completion_tokens=2048
        )
        full_report = validation.choices[0].message.content
        print("✅ Report validated and corrected for hallucinations")
    except Exception as e:
        print(f"❌ Validation failed, using original report: {e}")
        # Keep original report if validation fails

    # 2. Save to Database
    scores_json = json.dumps(request.dimensions)
    evidence_json = json.dumps(request.evidenceLog)
    
    db_assessment = models.Assessment(
        user_id=current_user.id,
        user_email=request.email,
        scores_json=scores_json,
        evidence_json=evidence_json,
        summary=request.summary,
        full_report=full_report
    )
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)
    
    return db_assessment

@app.post("/api/assessments", response_model=schemas.Assessment)
def create_assessment(assessment: schemas.AssessmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_assessment = models.Assessment(
        user_id=current_user.id,
        user_email=current_user.email,  # Ensure we have the email
        scores_json=json.dumps(assessment.scores),
        evidence_json=json.dumps(assessment.evidence),
        summary=assessment.summary,
        full_report=assessment.full_report
    )
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)
    return db_assessment

@app.get("/api/assessments", response_model=List[schemas.Assessment])
def read_assessments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    assessments = db.query(models.Assessment).filter(models.Assessment.user_id == current_user.id).order_by(models.Assessment.timestamp.desc()).offset(skip).limit(limit).all()
    return assessments

class InferInsightsRequest(schemas.BaseModel):
    evidenceLog: list
    dimensions: dict

@app.post("/api/infer-insights")
async def infer_insights(request: InferInsightsRequest):
    """Use LLM to infer strengths and development priorities from evidence log"""
    groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))

    prompt = f"""Analyze this coaching conversation evidence and identify key strengths and development priorities.

EVIDENCE LOG:
{json.dumps(request.evidenceLog, indent=2)}

DIMENSION SCORES:
{json.dumps(request.dimensions, indent=2)}

Return a JSON object with exactly this structure:
{{
    "strengths": ["S", "C", "O", "P", "E"],  // List only dimension codes where user showed strength
    "developmentPriorities": ["S", "C", "O", "P", "E"]  // List only dimension codes needing development
}}

Rules:
- strengths: Include dimension codes where user showed good understanding or positive engagement (based on evidence with "positive" sentiment)
- developmentPriorities: Include dimension codes with low scores or limited evidence
- Use ONLY these codes: S, C, O, P, E
- Each array should have 1-3 items max
- Base this ONLY on the evidence provided

Return ONLY the JSON object, no other text."""

    try:
        completion = await groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_completion_tokens=256
        )

        response_text = completion.choices[0].message.content
        # Extract JSON from response
        import re
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            result = json.loads(json_match.group())
            return result
        else:
            return {"strengths": [], "developmentPriorities": []}
    except Exception as e:
        print(f"Error inferring insights: {e}")
        return {"strengths": [], "developmentPriorities": []}

class FinalizeSessionRequest(schemas.BaseModel):
    email: str
    assessment: dict

@app.post("/api/finalize-session")
async def finalize_session(request: FinalizeSessionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        print(f"Finalizing S.C.O.P.E. FeedForward session for {request.email}")

        # --- Generate Living Story Synthesis using S.C.O.P.E. FeedForward Framework ---
        groq_client = AsyncGroq(api_key=os.getenv("GROQ_API_KEY"))
        
        # Extract narrative streams data
        narrative_streams = request.assessment.get('narrativeStreams', {})
        fragments = request.assessment.get('allFragments', [])
        phase = request.assessment.get('phase', 'CRYSTALLIZATION')

        # Extract dimension scores and evidence (fallback data when narrative streams are empty)
        dimensions = request.assessment.get('dimensions', {})
        evidence_log = request.assessment.get('evidenceLog', [])
        strengths = request.assessment.get('strengths', [])
        development_priorities = request.assessment.get('developmentPriorities', [])

        # Provide default strengths if none were identified during conversation
        if not strengths:
            strengths = [
                "Willingness to engage in coaching conversation",
                "Interest in growth-oriented feedback",
                "Openness to structured development approach"
            ]

        # Provide default growth opportunities if none were identified
        if not development_priorities:
            development_priorities = [
                "Building specificity in situation framing",
                "Developing distinct behavioral choices",
                "Connecting actions to deeper purpose"
            ]

        # Format dimensions for prompt
        dimension_labels = {
            'HL': 'Situation Awareness',
            'CM': 'Choices Recognition',
            'DI': 'Outcomes Visualization',
            'DL': 'Purpose Alignment',
            'PR': 'Engagement Commitment'
        }

        dimension_summaries = []
        for dim_code, dim_data in dimensions.items():
            if dim_data:
                score = dim_data.get('score', 2.5)
                confidence = dim_data.get('confidence', 'LOW')
                evidence_count = dim_data.get('evidenceCount', 0)
                trend = dim_data.get('trend', 'stable')
                label = dimension_labels.get(dim_code, dim_code)
                dimension_summaries.append(f"- {label}: {score}/5 ({confidence} confidence, {evidence_count} evidence points, trend: {trend})")

        # Format evidence log
        evidence_summaries = []
        for ev in evidence_log[:10]:  # Limit to 10 most recent
            if ev:
                dim = dimension_labels.get(ev.get('dimension', ''), ev.get('dimension', ''))
                ev_type = ev.get('type', 'contextual')
                summary = ev.get('summary', '')
                evidence_summaries.append(f"- [{dim}] ({ev_type}): {summary}")
        
        # Calculate story qualities
        def calculate_coherence(fragments_list):
            """How well fragments connect into threads"""
            if len(fragments_list) < 2:
                return 0.0
            entanglements = sum(len(f.get('entangledWith', [])) for f in fragments_list)
            max_connections = len(fragments_list) * 2
            return min(1.0, entanglements / max_connections)
        
        def calculate_fluidity(quantum_states):
            """How much story is still becoming (high = more potential)"""
            if not quantum_states:
                return 1.0
            # High fluidity when states are more evenly distributed (less certainty)
            probs = [s.get('probability', 0) for s in quantum_states]
            if not probs:
                return 1.0
            # Use entropy-like measure
            max_prob = max(probs)
            return 1.0 - (max_prob - 1/len(probs)) / (1 - 1/len(probs)) if len(probs) > 1 else 0.5
        
        def calculate_authenticity(yama_resonances):
            """Alignment with Constitutional AI principles"""
            if not yama_resonances:
                return 0.5
            alignment_count = sum(1 for y in yama_resonances if y.get('resonance') == 'harmony')
            return alignment_count / len(yama_resonances)
        
        # Prepare narrative data for synthesis
        stream_summaries = []
        for stream_id, stream_data in narrative_streams.items():
            if stream_data and stream_data.get('fragments'):
                coherence = calculate_coherence(stream_data.get('fragments', []))
                fluidity = calculate_fluidity(stream_data.get('possibleStates', []))
                authenticity = stream_data.get('authenticity', 0.5)
                
                stream_summaries.append(f"""
**{stream_data.get('streamName', stream_id)}**
- Coherence: {coherence:.1%} (fragment connectivity)
- Fluidity: {fluidity:.1%} (openness to becoming)
- Authenticity: {authenticity:.1%} (lived truth alignment)
- Fragments: {len(stream_data.get('fragments', []))}
- Quantum States: {len(stream_data.get('possibleStates', []))}
""")
        
        # CONSTITUTIONAL AI: Validator imported at top level

        # Build S.C.O.P.E. FeedForward Report synthesis prompt
        story_synthesis_prompt = f"""
You are generating a S.C.O.P.E. FEEDFORWARD REPORT based on Danny Simms' S.C.O.P.E. FeedForward Model™ (7020TEN).

This is a FUTURE-FOCUSED coaching report that prepares a manager to have a growth-oriented feedforward conversation.

## S.C.O.P.E. Framework
- **S**ituation - A specific upcoming moment (future-oriented, not past)
- **C**hoices - Two behavioral options (genuinely neutral, not loaded)
- **O**utcomes - Immediate results of each choice (observable, not long-term)
- **P**urpose - The deeper meaning/growth opportunity (inspiring, not punitive)
- **E**ngagement - How to invite collaboration (open-ended, not directive)

## Constitutional AI Guardrails (Yama Principles)
1. **Ahimsa (Non-harm)**: No judgmental language; describe behavior, not character
2. **Satya (Truthfulness)**: Realistic outcomes; mark confidence levels
3. **Asteya (Non-stealing)**: Credit Danny Simms; respect autonomy
4. **Brahmacharya (Right energy)**: Focus effort on weaker components
5. **Aparigraha (Non-attachment)**: Choices belong to the coachee; no "right" answer

## Session Data

**Manager**: {request.email}
**Session Date**: {phase}

**S.C.O.P.E. Component Scores**:
{chr(10).join(dimension_summaries) if dimension_summaries else "Components being developed"}

**Evidence from Conversation**:
{chr(10).join(evidence_summaries) if evidence_summaries else "Conversation evidence"}

**Strengths**: {', '.join(strengths) if strengths else 'Identified during session'}
**Growth Opportunities**: {', '.join(development_priorities) if development_priorities else 'Identified during session'}

**Conversation Fragments**:
{json.dumps(fragments[:10], indent=2) if fragments else "Session fragments"}

**Session Summary**:
- Turn Count: {request.assessment.get('turnCount', 0)}
- Summary: {request.assessment.get('summary', '')}

## Report Generation Guidelines

### 1. EXTRACT S.C.O.P.E. COMPONENTS
From the conversation, identify and structure:
- **Situation**: A brief 1-2 sentence description of the coaching scenario based ONLY on conversation evidence. Do NOT invent specific times (Monday, Friday, 10am), locations (office, conference room), or relationship terms (direct report, line manager) - keep it general.
- **Choices**: Two genuine behavioral options with no implied "right" answer
- **Outcomes**: Immediate observable results for each choice
- **Purpose**: Growth opportunity and connection to values/goals
- **Engagement**: Invitation language that builds psychological safety

### CRITICAL ANTI-HALLUCINATION RULES
- ONLY use information from the Evidence/Fragments above
- NEVER invent:
  * Days/times (Monday, Friday, 10am, tomorrow)
  * Locations (conference room, office, virtual meeting)
  * Relationships (direct report, line manager, team member) unless explicitly stated
  * People's names
  * Meeting types (1:1, performance review)
- Use generic phrases: "When you have this conversation...", "The person you're coaching..."

### 2. SCORE EACH COMPONENT (0-100)
Rate each component on its quality criteria:
- Situation: Specificity, future-orientation, observability
- Choices: Behavioral clarity, genuine neutrality, within control
- Outcomes: Immediacy, observability, causality link
- Purpose: Meaningfulness, growth-orientation, personal relevance
- Engagement: Open-endedness, safety-building, collaboration

### 3. GENERATE DUAL SCRIPTS
Create both versions for the manager:
- **Formal Script**: Complete word-for-word structured conversation
- **Conversational Script**: Natural flowing dialogue version

### 4. INFER STRENGTHS AND OPPORTUNITIES
Even from brief conversations, identify:
- **Strengths**: What the manager already does well (e.g., "clear situation framing", "genuine care for growth")
- **Growth Opportunities**: Where the conversation could be stronger (e.g., "making choices more distinct", "connecting to deeper purpose")

ALWAYS infer at least 2-3 strengths and 2-3 opportunities from any interaction length.

### 5. PREPARATION CHECKLIST
Include actionable steps for before, during, and after the conversation.

## Output Format Requirements

Generate clean, professional HTML for the S.C.O.P.E. FeedForward Report.

**Visual Style Guide**:
- Professional, clean design (not overly decorative)
- Color palette: Indigo (#4f46e5) for primary, Emerald (#059669) for success, Amber (#d97706) for growth opportunities
- Typography: System fonts, generous line-height (1.6+)
- Component cards with quality scores
- Script sections clearly formatted for easy reading
- **CRITICAL**: All text must be dark and readable. Use #0f172a for headers, #334155 for body text, #64748b for muted text.

**Structure**:
<div style="font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #4f46e5; font-size: 2em; margin-bottom: 0.5em;">S.C.O.P.E. FeedForward Report</h1>
  <p style="color: #64748b; font-style: italic; margin-bottom: 2em;">Future-Focused Coaching Conversation · Based on Danny Simms' S.C.O.P.E. FeedForward Model™</p>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #4f46e5; padding-left: 1em;">📋 Conversation Overview</h2>
    <p style="line-height: 1.7; color: #334155;">[One-sentence summary of the feedforward conversation being designed]</p>
    <div style="margin-top: 1em; padding: 1em; background: #f1f5f9; border-radius: 8px;">
      <strong>Overall Readiness:</strong> [Score]/100
    </div>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #06b6d4; padding-left: 1em;">🎯 S - Situation</h2>
    <div style="padding: 1em; background: #f0f9ff; border-radius: 8px; margin-bottom: 1em;">
      <strong>Quality Score:</strong> [Score]/100
    </div>
    <p style="line-height: 1.7; color: #334155;">[Brief 1-2 sentence description of the coaching scenario from the conversation. No specific times, locations, or relationship terms unless explicitly discussed.]</p>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #8b5cf6; padding-left: 1em;">🔀 C - Choices</h2>
    <div style="padding: 1em; background: #faf5ff; border-radius: 8px; margin-bottom: 1em;">
      <strong>Quality Score:</strong> [Score]/100
    </div>
    <div style="display: grid; gap: 1em;">
      <div style="padding: 1em; border: 2px solid #e0e7ff; border-radius: 8px;">
        <strong>Choice A:</strong> [Behavioral option 1]
      </div>
      <div style="padding: 1em; border: 2px solid #e0e7ff; border-radius: 8px;">
        <strong>Choice B:</strong> [Behavioral option 2]
      </div>
    </div>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #10b981; padding-left: 1em;">📈 O - Outcomes</h2>
    <div style="padding: 1em; background: #f0fdf4; border-radius: 8px; margin-bottom: 1em;">
      <strong>Quality Score:</strong> [Score]/100
    </div>
    <p><strong>If Choice A →</strong> [Immediate observable result]</p>
    <p><strong>If Choice B →</strong> [Immediate observable result]</p>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #f59e0b; padding-left: 1em;">💡 P - Purpose</h2>
    <div style="padding: 1em; background: #fffbeb; border-radius: 8px; margin-bottom: 1em;">
      <strong>Quality Score:</strong> [Score]/100
    </div>
    <blockquote style="border-left: 3px solid #f59e0b; padding-left: 1em; margin: 1em 0; font-style: italic;">
      [The deeper meaning and growth opportunity]
    </blockquote>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #ec4899; padding-left: 1em;">🤝 E - Engagement</h2>
    <div style="padding: 1em; background: #fdf2f8; border-radius: 8px; margin-bottom: 1em;">
      <strong>Quality Score:</strong> [Score]/100
    </div>
    <p><strong>Invitation:</strong> "[Open-ended question to invite collaboration]"</p>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #4f46e5; padding-left: 1em;">📝 Conversation Scripts</h2>
    <h3 style="color: #334155;">Formal Script</h3>
    <div style="padding: 1.5em; background: #f8fafc; border-radius: 8px; font-family: Georgia, serif; line-height: 1.8;">
      [Complete word-for-word script following S.C.O.P.E. sequence]
    </div>
    <h3 style="color: #334155; margin-top: 1.5em;">Conversational Script</h3>
    <div style="padding: 1.5em; background: #f8fafc; border-radius: 8px; font-family: Georgia, serif; line-height: 1.8;">
      [Natural flowing version of the same conversation]
    </div>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #059669; padding-left: 1em;">✨ Strengths</h2>
    <ul style="color: #334155;">[List 2-3 things the manager does well in this conversation design]</ul>
  </section>

  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #d97706; padding-left: 1em;">🌱 Growth Opportunities</h2>
    <ul style="color: #334155;">[List 2-3 ways to strengthen the conversation]</ul>
  </section>
</div>

**Tone**: Professional, supportive, growth-oriented. Use future tense ("you will," "they can").
**Language**: Clear, actionable, coaching-focused. NO medical, diagnostic, or quantum jargon.

IMPORTANT: DO NOT include footer, copyright, or "© 2024" text. System adds official footer automatically.

CRITICAL: ALWAYS populate the Strengths and Growth Opportunities sections with specific, inferred insights even from brief conversations. Never leave them empty.
"""

        completion = await groq_client.chat.completions.create(
            model="moonshotai/kimi-k2-instruct-0905",
            messages=[{"role": "user", "content": story_synthesis_prompt}],
            temperature=0.75,  # Slightly higher for creative narrative synthesis
            max_completion_tokens=4096
        )
        
        ai_report_html = completion.choices[0].message.content
        # Strip markdown code blocks if present
        ai_report_html = ai_report_html.replace("```html", "").replace("```", "")
        
        # ===================================================================
        # CONSTITUTIONAL AI VALIDATION (ATOMIC OPERATION WITH RECEIPT)
        # ===================================================================
        validation_receipt = validate_story_synthesis(ai_report_html, fragments)
        
        print(f"\n✅ Constitutional Validation: {validation_receipt['summary']}")
        print(f"📜 Receipt ID: {validation_receipt['receipt_id']}")
        
        if validation_receipt['validation_result'] == 'FAILED':
            # Log violations but continue (for research audit trail)
            for violation in validation_receipt['violations']:
                print(f"  ⚠️  {violation['principle']}: {violation['explanation']}")
        
        # Export receipts for PhD documentation
        receipt_filename = f"constitutional_receipts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        export_all_receipts(receipt_filename)
        print(f"📂 Constitutional receipts exported: {receipt_filename}")
        
        # Attach Constitutional AI footer to report
        constitutional_footer = f"""
        <div style="margin-top: 40px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 8px; color: white; font-size: 11px;">
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px;">🛡️ S.C.O.P.E. FeedForward Model™ by Danny Simms</div>
            <div style="opacity: 0.9;">
                <strong>Receipt ID:</strong> {validation_receipt['receipt_id']}<br>
                <strong>Status:</strong> {validation_receipt['validation_result']}<br>
                <strong>Coaching Ethics:</strong> {len(validation_receipt['harmonies'])} in harmony, {len(validation_receipt['violations'])} requiring attention<br>
                <strong>Validation Time:</strong> {validation_receipt['timestamp']}<br>
            </div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 10px; opacity: 0.7;">
                This coaching conversation was validated against Constitutional AI coaching ethics: Ahimsa (non-harm),
                Satya (truthfulness), Asteya (non-stealing), Brahmacharya (right energy), Aparigraha (non-attachment)
            </div>
        </div>
        """
        ai_report_html += constitutional_footer
        
        # Inject into assessment data
        request.assessment['ai_report_html'] = ai_report_html
        request.assessment['story_synthesis_mode'] = 'scope_feedforward'
        request.assessment['constitutional_receipt_id'] = validation_receipt['receipt_id']

        # ===================================================================
        # THREE-TIER VALIDATION ARCHITECTURE: Human Review Queue
        # (ReviewQueueManager imported at top level)
        # ===================================================================

        # Determine journey mode from narrative content
        mode = JourneyMode.MEDICAL if any(
            'medication' in str(f).lower() or 'insulin' in str(f).lower() 
            for f in fragments
        ) else JourneyMode.PREVENTIVE
        
        # Submit report for review (includes LLM harm detection via Claude)
        review_manager = ReviewQueueManager(db)
        review = await review_manager.submit_report_for_review(
            session_id=request.assessment.get('sessionId', 'unknown'),
            user_id=current_user.id,
            user_email=request.email,
            user_role=getattr(current_user, 'role', 'user'),  # Assume 'user' if no role field
            report_html=ai_report_html,
            groq_metadata={
                'model': 'moonshotai/kimi-k2-instruct-0905',
                'temperature': 0.75,
                'phase': phase,
                'fragments_count': len(fragments),
                'turn_count': request.assessment.get('turnCount', 0),
                'coherence': calculate_coherence(fragments),
                'fluidity': calculate_fluidity(request.assessment.get('scopeStates', [])),
                'authenticity': calculate_authenticity(request.assessment.get('yamaResonances', []))
            },
            mode=mode,
            fragments=fragments,
            session_data={
                'narrative_streams': narrative_streams,
                'scope_states': request.assessment.get('scopeStates', []),
                'yama_resonances': request.assessment.get('yamaResonances', []),
                'summary': request.assessment.get('summary', '')
            }
        )
        
        # Handle response based on review status
        # BETA MODE: Auto-approve all reports and send immediately
        # TODO: Remove this bypass for production
        if True:  # Was: review.status == 'approved'
            # Auto-approved (BETA MODE - all reports sent immediately)
            print(f"📧 BETA MODE: Sending email immediately to {request.email}")
            success = send_assessment_email(request.email, request.assessment)
            if not success:
                raise HTTPException(status_code=500, detail="Failed to send email report")

            return {
                "status": "delivered",
                "message": "Living story synthesis sent successfully",
                "review_id": review.report_id,
                "delivery_method": "immediate"
            }
        else:
            # Pending human review (disabled in BETA)
            return {
                "status": "pending_review",
                "message": "Your health report will be reviewed and emailed within 24 hours",
                "review_id": review.report_id,
                "estimated_delivery": "24 hours"
            }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in finalize_session: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate or send story synthesis: {str(e)}")

# ===================================================================
# ADMIN API: Review Queue Management
# ===================================================================

@app.get("/api/admin/pending-reports")
async def get_pending_reports(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin)
):
    """
    Get all reports pending human review.
    Returns de-identified context for reviewer.
    """
    review_manager = ReviewQueueManager(db)
    pending = review_manager.get_pending_reviews()
    
    # Format response for dashboard
    reports = []
    for review in pending:
        reports.append({
            "report_id": review.report_id,
            "created_at": review.created_at.isoformat() if review.created_at else None,
            "risk_level": review.risk_level,
            "flagged_sections_count": review.flagged_sections_count,
            "mode": review.mode,
            "key_themes": review.key_themes,
            "user_journey_summary": review.user_journey_summary,
            "requires_human_review": review.requires_human_review,
            "llm_analysis": review.llm_analysis  # Full Claude analysis
        })
    
    return {"pending_reports": reports, "count": len(reports)}

@app.post("/api/admin/review-report/{report_id}")
async def submit_review_decision(
    report_id: str,
    decision: dict,  # {"decision": "approve|reject|revise", "reviewer_notes": "..."}
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin)
):
    """
    Submit reviewer decision on a pending report.
    If approved, delivers report to user via email.
    """
    review_manager = ReviewQueueManager(db)
    
    # Submit decision
    updated_review = review_manager.submit_reviewer_decision(
        report_id=report_id,
        reviewer_id=admin_user.id,
        decision=decision['decision'],
        reviewer_notes=decision.get('reviewer_notes', '')
    )
    
    if not updated_review:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # If approved, deliver report
    if updated_review.reviewer_decision == 'approve':
        # Reconstruct assessment data for email delivery
        assessment_data = {
            'ai_report_html': updated_review.report_html,
            'story_synthesis_mode': 'scope_feedforward',
            'constitutional_receipt_id': updated_review.groq_synthesis_metadata.get('constitutional_receipt_id', ''),
            'summary': updated_review.groq_synthesis_metadata.get('summary', '')
        }
        
        success = send_assessment_email(updated_review.user_email, assessment_data)
        if not success:
            raise HTTPException(status_code=500, detail="Review approved but email delivery failed")
        
        # Update delivery timestamp
        updated_review.delivered_at = datetime.utcnow()
        updated_review.delivery_method = 'email'
        db.commit()
    
    return {
        "status": "success",
        "report_id": report_id,
        "decision": updated_review.reviewer_decision,
        "delivered": updated_review.delivered_at is not None
    }

@app.get("/api/admin/review-stats")
async def get_review_stats(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin)
):
    """
    Get review queue statistics for admin dashboard.
    """
    review_manager = ReviewQueueManager(db)
    stats = review_manager.get_review_stats()
    
    return stats

@app.get("/api/admin/report-details/{report_id}")
async def get_report_details(
    report_id: str,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin)
):
    """
    Get full report details for review (de-identified).
    """
    review_manager = ReviewQueueManager(db)
    review = review_manager.get_review_by_id(report_id)
    
    if not review:
        raise HTTPException(status_code=404, detail="Report not found")
    
    return {
        "report_id": review.report_id,
        "status": review.status,
        "risk_level": review.risk_level,
        "flagged_sections_count": review.flagged_sections_count,
        "mode": review.mode,
        "key_themes": review.key_themes,
        "user_journey_summary": review.user_journey_summary,
        "report_html": review.report_html,
        "llm_analysis": review.llm_analysis,
        "groq_metadata": review.groq_synthesis_metadata,
        "created_at": review.created_at.isoformat() if review.created_at else None,
        "requires_human_review": review.requires_human_review,
        "reviewer_notes": review.reviewer_notes,
        "reviewer_decision": review.reviewer_decision
    }

# --- Static Files (React App) ---
# Serve static files from the 'dist' directory
# We need to go up one level from 'backend' to find 'dist'
DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")

if os.path.exists(DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(DIST_DIR, "assets")), name="assets")
    # You might need to mount other folders if they exist in dist, e.g. favicon
    
    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        # If API request, return 404 (should be handled by API routes above)
        if full_path.startswith("api/"):
             raise HTTPException(status_code=404, detail="Not Found")
        
        # Check if file exists in dist
        file_path = os.path.join(DIST_DIR, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Otherwise return index.html for SPA routing
        return FileResponse(os.path.join(DIST_DIR, "index.html"))
else:
    print(f"WARNING: dist directory not found at {DIST_DIR}. Run 'npm run build' first.")

