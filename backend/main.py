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
    You are a MetaGuardian qualitative research synthesizer. Create a comprehensive research interview summary based on the participant's session data.

    Participant Email: {request.email}

    KEY THEMES IDENTIFIED:
    {', '.join(request.strengths) if request.strengths else 'None identified'}

    AREAS FOR FURTHER EXPLORATION:
    {', '.join(request.developmentPriorities) if request.developmentPriorities else 'None identified'}

    INTERVIEW EVIDENCE LOG:
    {json.dumps(request.evidenceLog, indent=2)}

    SESSION SUMMARY: {request.summary}

    Please write a professional research interview summary in Markdown format.
    Structure it with:
    1. Executive Summary - Key insights from this research interview
    2. Thematic Analysis - Main themes that emerged with supporting quotes/evidence
    3. Participant Perspectives - Notable viewpoints and experiences shared
    4. Research Implications - How this contributes to the research questions

    Use an academic but accessible tone appropriate for qualitative research reporting.
    """
    
    try:
        completion = await groq_client.chat.completions.create(
            model="moonshotai/kimi-k2-instruct-0905",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_completion_tokens=2048
        )
        full_report = completion.choices[0].message.content
    except Exception as e:
        print(f"Error generating report: {e}")
        full_report = "Report generation failed. Please contact support."

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

class FinalizeSessionRequest(schemas.BaseModel):
    email: str
    assessment: dict

@app.post("/api/finalize-session")
async def finalize_session(request: FinalizeSessionRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        print(f"Finalizing quantum story session for {request.email}")

        # --- Generate Living Story Synthesis using Quantum Storytelling Framework ---
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

        # Format dimensions for prompt
        dimension_labels = {
            'HL': 'Health Literacy',
            'CM': 'Clinical Markers',
            'DI': 'Data Integration',
            'DL': 'Digital Literacy',
            'PR': 'Preventive Readiness'
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

        # Build quantum storytelling synthesis prompt
        story_synthesis_prompt = f"""
You are synthesizing a LIVING HEALTH STORY using David Boje's Quantum Storytelling framework.
This is NOT an assessment—it's witnessing a story-in-the-making.

⚠️ CONSTITUTIONAL GUARDRAILS (Yama Principles):
1. Ahimsa: Never force a story the user isn't ready to tell
2. Satya: Honor contradictions without resolution
3. Asteya: The story belongs to the user
4. Brahmacharya: Match depth to user's capacity  
5. Aparigraha: Share patterns without claiming ownership

## Session Data

**User**: {request.email}
**Story Phase**: {phase}

**Metabolic Health Readiness Scores**:
{chr(10).join(dimension_summaries) if dimension_summaries else "No dimension scores yet"}

**Evidence Collected**:
{chr(10).join(evidence_summaries) if evidence_summaries else "No evidence collected yet"}

**Strengths Identified**: {', '.join(strengths) if strengths else 'None identified yet'}
**Development Priorities**: {', '.join(development_priorities) if development_priorities else 'None identified yet'}

**Narrative Streams**:
{chr(10).join(stream_summaries) if stream_summaries else "No narrative streams captured yet"}

**Antenarrative Fragments** (user's actual story bits):
{json.dumps(fragments[:10], indent=2) if fragments else "No fragments captured yet"}

**Overall Session**:
- Total Fragments: {len(fragments)}
- Turn Count: {request.assessment.get('turnCount', 0)}
- Summary: {request.assessment.get('summary', '')}

## Synthesis Guidelines (Critical - Read Carefully)

### 1. HONOR ANTENARRATIVES (Don't Force Coherence)
- Quote the user's EXACT speculative fragments
- Preserve tensions and contradictions—do NOT resolve them
- List multiple possible story endings (don't choose one)
- Use language like "You said..." or "In your words..."

### 2. EMBRACE QUANTUM SUPERPOSITION
Present multiple simultaneous truths from quantum states:
- Example: "You are BOTH 60% Empowered Tracker AND 30% Anxious Monitor AND 10% Compliant Patient"
- Visualize probability distributions with styled percentage badges
- Show which states conflict and which reinforce each other
- NEVER force a single identity—honor the multiplicity

### 3. MAP TEMPORAL ENTANGLEMENT
Create a three-column temporal collapse view:
- **LEFT COLUMN (Past)**: Health stories user references from their history
- **CENTER COLUMN (Present)**: Current lived health experiences  
- **RIGHT COLUMN (Future)**: Imagined health trajectories user is authoring

Use visual metaphors like "Then → Now → Becoming" or "Memory ⟷ Moment ⟷ Possibility"

### 4. SURFACE GRAND NARRATIVES
Identify cultural/medical discourses the user negotiates with:
- Medical Authority: Is user [accepting/resisting/negotiating/transforming]?
- Quantified Self Movement: What's their stance?
- Genetic Determinism: How does family history shape their story?
- Wellness Industry: Do they buy in, push back, or selectively engage?

Display as styled badges showing discourse + stance

### 5. OFFER STORY PATHS (Not Prescriptions)
Present 3 possible futures as story continuations (not recommendations):

**Path A: [Evocative Name]**
"If you continue this thread... [scenario that honors their current fragments]"

**Path B: [Evocative Name]**  
"If you explore this tension... [alternative possibility from contradictions]"

**Path C: [Evocative Name]**
"If you transform this pattern... [emergent potential from quantum states]"

**CRITICAL**: Frame as "possible chapters," NOT "you should." The story belongs to the user.

### 6. CONSTITUTIONAL AI: Yama Storytelling Ethics
- **Ahimsa**: Never force a story the user isn't ready to tell
- **Satya**: Honor contradictions—don't resolve them falsely  
- **Asteya**: The story belongs to the user, not the system
- **Brahmacharya**: Match narrative depth to user's emotional capacity
- **Aparigraha**: Share story patterns without claiming ownership

If user shows resistance or tension, ACKNOWLEDGE IT, don't fix it.

## Output Format Requirements

Generate HTML with **organic, fractal visual language** (NOT rigid clinical tables).

**Visual Style Guide**:
- Use flowing, rounded containers (border-radius: 16px+)
- Gradient backgrounds for quantum state bubbles
- Soft shadows for depth (box-shadow with 20%+ opacity)
- Color palette: Deep purples (#4f46e5), teals (#06b6d4), ambers (#f59e0b)
- Typography: Use em units, generous line-height (1.6+)
- Quantum state probabilities as animated progress circles or bubbles
- Temporal entanglement as 3-column grid with connecting lines/dots
- **CRITICAL**: NEVER use white (#fff, #ffffff, white) or near-white text colors. All text must be dark and readable on white/light backgrounds. Use #0f172a for headers, #334155 for body text, #64748b for muted text.

**Structure**:
<div style="font-family: system-ui; max-width: 800px; margin: 0 auto; padding: 2rem;">
  <h1 style="color: #4f46e5; font-size: 2em; margin-bottom: 0.5em;">Your Living Health Story</h1>
  <p style="color: #64748b; font-style: italic; margin-bottom: 2em;">A quantum narrative synthesis · Story phase: {phase}</p>
  
  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #4f46e5; padding-left: 1em;">Story-in-the-Making</h2>
    <p style="line-height: 1.7; color: #334155;">[Synthesis of what emerged, honoring multiplicity]</p>
  </section>
  
  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #06b6d4; padding-left: 1em;">Quantum Superposition: Your Simultaneous Truths</h2>
    [Quantum state bubbles with probabilities]
  </section>
  
  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #f59e0b; padding-left: 1em;">Temporal Entanglement</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1.5em;">
      <div><h3>Then (Past)</h3>[past stories]</div>
      <div><h3>Now (Present)</h3>[present moments]</div>
      <div><h3>Becoming (Future)</h3>[future imaginaries]</div>
    </div>
  </section>
  
  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #8b5cf6; padding-left: 1em;">Grand Narratives You're Navigating</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 0.75em; margin-top: 1em;">
      <!-- Each badge should use this format: -->
      <span style="display: inline-block; padding: 0.5em 1em; background: #f3e8ff; border-radius: 8px; color: #334155; font-size: 0.9em; margin-bottom: 0.5em;">
        <strong style="color: #8b5cf6;">[Narrative Name]:</strong> [Stance]
      </span>
      <!-- Example: <span style="..."><strong>Medical Authority:</strong> Negotiating</span> -->
    </div>
  </section>
  
  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #10b981; padding-left: 1em;">Three Possible Story Paths</h2>
    [Path A, B, C as cards with evocative names]
  </section>
  
  <section style="margin-bottom: 3em;">
    <h2 style="color: #0f172a; border-left: 4px solid #ec4899; padding-left: 1em;">Story Qualities</h2>
    <div style="display: flex; gap: 2em;">
      <div>
        <div style="font-size: 2em; color: #4f46e5;">[coherence]%</div>
        <div style="color: #64748b;">Coherence</div>
      </div>
      <div>
        <div style="font-size: 2em; color: #06b6d4;">[fluidity]%</div>
        <div style="color: #64748b;">Fluidity</div>
      </div>
      <div>
        <div style="font-size: 2em; color: #f59e0b;">[authenticity]%</div>
        <div style="color: #64748b;">Authenticity</div>
      </div>
    </div>
  </section>
</div>

**Tone**: Read as WITNESSING, not DIAGNOSING. Use present progressive tense ("you are becoming," "the story is emerging").
**Language**: Poetic yet precise. Fractal/organic metaphors (roots, rivers, constellations), NOT clinical/corporate jargon.

IMPORTANT: DO NOT include footer, copyright, or "© 2024" text. System adds official footer automatically.
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
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 10px;">🛡️ Constitutional AI Validation</div>
            <div style="opacity: 0.9;">
                <strong>Receipt ID:</strong> {validation_receipt['receipt_id']}<br>
                <strong>Status:</strong> {validation_receipt['validation_result']}<br>
                <strong>Yama Principles:</strong> {len(validation_receipt['harmonies'])} in harmony, {len(validation_receipt['violations'])} requiring attention<br>
                <strong>Validation Time:</strong> {validation_receipt['timestamp']}<br>
            </div>
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3); font-size: 10px; opacity: 0.7;">
                This narrative synthesis was validated against Constitutional AI principles: Ahimsa (non-harm), 
                Satya (truthfulness), Asteya (non-stealing), Brahmacharya (right energy), Aparigraha (non-attachment)
            </div>
        </div>
        """
        ai_report_html += constitutional_footer
        
        # Inject into assessment data
        request.assessment['ai_report_html'] = ai_report_html
        request.assessment['story_synthesis_mode'] = 'quantum'
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
                'fluidity': calculate_fluidity(request.assessment.get('quantumStates', [])),
                'authenticity': calculate_authenticity(request.assessment.get('yamaResonances', []))
            },
            mode=mode,
            fragments=fragments,
            session_data={
                'narrative_streams': narrative_streams,
                'quantum_states': request.assessment.get('quantumStates', []),
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
            'story_synthesis_mode': 'quantum',
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

