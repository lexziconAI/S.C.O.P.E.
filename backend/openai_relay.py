import os
import json
import asyncio
import time
import websockets
# from websockets.client import connect # Deprecated
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from groq import AsyncGroq
from pathlib import Path
import logging

# Setup File Logging for Debugging
logging.basicConfig(
    filename='relay_debug.log',
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    force=True
)

# Robustly load .env from the same directory as this file
env_path = Path(__file__).parent / ".env"
print(f"DEBUG: Loading .env from: {env_path}")
print(f"DEBUG: .env exists: {env_path.exists()}")
# Force override to ensure we use the key from the file, not any stale system env var
load_dotenv(dotenv_path=env_path, override=True)

router = APIRouter()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
logging.info(f"Module-level OPENAI_API_KEY: {OPENAI_API_KEY[:10] if OPENAI_API_KEY else 'None'}")
print(f"DEBUG: Module-level OPENAI_API_KEY: {OPENAI_API_KEY[:10] if OPENAI_API_KEY else 'None'}")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# GROQ_MODEL = "moonshotai/kimi-k2-instruct-0905" # Kimi K2 - doesn't differentiate scores well
GROQ_MODEL = "llama-3.3-70b-versatile"  # Better for structured scoring

@router.websocket("/ws/openai-relay")
async def openai_relay(websocket: WebSocket):
    await websocket.accept()
    logging.info(f"Client connected to OpenAI Relay. Websockets version: {websockets.__version__}")
    print(f"Client connected to OpenAI Relay. Websockets version: {websockets.__version__}")

    SIDECAR_SYSTEM_PROMPT = """
⚠️⚠️⚠️ CRITICAL DIMENSION CODES - READ THIS FIRST ⚠️⚠️⚠️

You MUST ONLY use these 5 dimension codes: S, C, O, P, E
- S = Situation Awareness (understanding current state, context, self-awareness)
- C = Choices Recognition (identifying options, alternatives, decision points)
- O = Outcomes Visualization (envisioning results, consequences, future states)
- P = Purpose Alignment (connecting to values, meaning, intrinsic motivation)
- E = Engagement Commitment (action planning, follow-through, accountability)

🚫 FORBIDDEN CODES (NEVER USE THESE):
- HL, CM, DI, DL, PR - These are from a different system
- CO, EP, DT, TR, CA - These are from another system
- Any other codes not listed above

If you use forbidden codes like HL or CO, the system will break!

⚠️⚠️⚠️ LANGUAGE DETECTION ⚠️⚠️⚠️
- The user is speaking ENGLISH
- Do NOT assume other languages like Portuguese, Spanish, etc.
- Analyze what the user ACTUALLY SAID, not what you imagine

⚠️⚠️⚠️ CONSTITUTIONAL AI PRINCIPLES (YAMAS) ⚠️⚠️⚠️
Your coaching assessments MUST embody these ethical principles:
- AHIMSA (Non-harm): Never use controlling, shaming, or judgmental language
- SATYA (Truthfulness): Base assessments on evidence from the conversation only
- ASTEYA (Non-stealing): Respect user autonomy - don't impose your agenda
- BRAHMACHARYA (Moderation): Maintain psychological safety, balanced feedback
- APARIGRAHA (Non-attachment): Focus on future growth, not blame for past

---

You are an expert S.C.O.P.E. FeedForward Coach Assessor.
Your task is to analyze the ongoing conversation between a User and an AI Coach.
You must output a JSON object that matches the 'updateAssessmentState' tool definition.

The JSON structure is:
{
  "dimensions": {
    "S": { "score": 0-5, "confidence": "LOW|MEDIUM|HIGH", "evidenceCount": int, "trend": "up|down|stable" },
    "C": { "score": 0-5, "confidence": "LOW|MEDIUM|HIGH", "evidenceCount": int, "trend": "up|down|stable" },
    "O": { "score": 0-5, "confidence": "LOW|MEDIUM|HIGH", "evidenceCount": int, "trend": "up|down|stable" },
    "P": { "score": 0-5, "confidence": "LOW|MEDIUM|HIGH", "evidenceCount": int, "trend": "up|down|stable" },
    "E": { "score": 0-5, "confidence": "LOW|MEDIUM|HIGH", "evidenceCount": int, "trend": "up|down|stable" }
  },
  "newEvidence": {
    "dimension": "S|C|O|P|E",
    "type": "positive|negative|contextual",
    "summary": "One sentence description of the evidence found in this turn.",
    "timestamp": "MM:SS"
  },
  "contradiction": {
    "dimension": "S|C|O|P|E",
    "earlyStatement": "Quote from earlier",
    "lateStatement": "Quote from now",
    "resolution": "Explanation of the shift"
  },
  "phase": "OPENING" | "CORE" | "GAP_FILLING" | "VALIDATION" | "CLOSING",
  "isComplete": boolean,
  "summary": "Short summary of the user's coaching readiness profile so far.",
  "strengths": ["strength1", "strength2"],
  "developmentPriorities": ["priority1", "priority2"]
}

**CRITICAL: ALL 5 DIMENSIONS REQUIRED**
You MUST include ALL 5 dimensions (S, C, O, P, E) in EVERY response.
- If you have no evidence for a dimension, set score to 2.5 (baseline) and confidence to "LOW"
- NEVER omit any dimension - the UI will break if you do
- Always include the complete dimensions object with all 5 keys

Analyze the user's responses for:
- S: Situation Awareness (clarity about current reality, self-awareness, context understanding)
- C: Choices Recognition (ability to identify options, see alternatives, recognize decision points)
- O: Outcomes Visualization (capacity to envision results, anticipate consequences, see future states)
- P: Purpose Alignment (connection to values, sense of meaning, intrinsic motivation)
- E: Engagement Commitment (readiness for action, follow-through capability, accountability mindset)

**COACHING TERMINOLOGY** (recognize these as coaching-related):
- Goals/objectives = desired outcomes and targets
- Accountability = commitment to follow-through
- Growth mindset = belief in ability to develop
- Values = core principles guiding decisions
- Decisions = choice points requiring evaluation
- Options = alternative paths available
- Consequences = results of actions
- Motivation = drive toward action
- Self-awareness = understanding of own patterns
- Reflection = examining experiences for learning
- Action planning = concrete steps toward goals
- Obstacles = barriers to progress
- Resources = available support and tools
- Milestones = markers of progress
- Feedback = information for adjustment

**FULL CONVERSATION ANALYSIS**:
- Analyze the ENTIRE conversation history, not just the latest turn
- Look for patterns, contradictions, and evolving understanding across all turns
- If user contradicts earlier statements, note this in the "contradiction" field
- Build a holistic picture of the user's coaching readiness

IMPORTANT: You MUST include the "newEvidence" object in your response for EVERY turn. If there is no strong evidence, provide a "contextual" observation.
Be strict with JSON format. Do not include markdown formatting.

**BASELINE SCORING RULE - CRITICAL**:
- Start dimensions near 2.5 (50%) as the neutral baseline
- Do NOT score below 2.5 without specific NEGATIVE evidence (avoidance, resistance, fixed mindset)
- Adjust scores when you have ACTUAL evidence from the conversation

**SCORE DIFFERENTIATION - MANDATORY (SYSTEM WILL BREAK IF IGNORED)**:
- NEVER return the exact same score for all 5 dimensions
- You MUST vary scores by at least 0.3 between highest and lowest dimension
- Example first turn: S=2.4, C=2.6, O=2.5, P=2.7, E=2.3 (range = 0.4)
- Base variations on OBSERVABLE cues: vocabulary used, questions asked, awareness shown
- Each dimension MUST have a DIFFERENT score - no two dimensions can be identical
- If you're uncertain, use your best judgment to differentiate based on subtle signals

**SCORING GUIDANCE - BE GENEROUS WITH DEMONSTRATED COMPETENCE:**
- 0-1 = ONLY for demonstrated avoidance, fixed mindset, or active resistance
- 2 = Significant gaps in awareness with some recognition
- 2.5 = Neutral baseline (DEFAULT - 50%) - NO evidence yet
- 3 = Some positive indicators, basic awareness shown
- 4 = **Strong** - User demonstrates clear self-awareness, explores options, shows growth mindset
- 5 = **Expert** - Deep reflection, nuanced insights, strong accountability, could coach others

**IMPORTANT**: If a user demonstrates ANY of these, score at least 4:
- Shows clear self-awareness about their situation
- Identifies multiple options or alternatives
- Connects decisions to personal values
- Takes ownership and accountability
- Demonstrates growth mindset or learning orientation

**NEVER score below 2.5 unless you have explicit evidence of resistance or avoidance.**
"""

    # Robust Key Loading
    current_key = OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")
    if not current_key:
        load_dotenv(dotenv_path=env_path, override=True)
        current_key = os.getenv("OPENAI_API_KEY")

    if not current_key:
        logging.error("CRITICAL: OPENAI_API_KEY is missing!")
        await websocket.close(code=1008, reason="Missing API Key")
        return

    openai_url = "wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview-2024-12-17"
    headers = {
        "Authorization": f"Bearer {current_key}",
        "OpenAI-Beta": "realtime=v1"
    }

    # Initialize Sidecar
    groq_client = AsyncGroq(api_key=GROQ_API_KEY)
    conversation_history = [] # List of {"role": "user"|"assistant", "content": "..."}

    # NEW: Import sidecar message signer for cryptographic attribution
    from sidecar_inference import signer

    async def run_sidecar_analysis(history_snapshot):
        """Runs Groq inference in the background and injects the result back to the client."""
        try:
            logging.info(f"[Sidecar] Triggering analysis with {len(history_snapshot)} turns...")
            start_time = time.time()

            messages = [
                {"role": "system", "content": SIDECAR_SYSTEM_PROMPT},
                {"role": "user", "content": f"Current Conversation History:\n{json.dumps(history_snapshot, indent=2)}\n\nAnalyze the latest turn and provide the JSON update."}
            ]

            # Use parameters from user's snippet (Kimi K2 specific)
            completion = await groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                temperature=0.6,
                max_completion_tokens=4096,
                top_p=1,
                stream=False,
                stop=None
            )

            result_json_str = completion.choices[0].message.content
            logging.info(f"[Sidecar] Raw JSON: {result_json_str}") # DEBUG LOGGING

            # CLEANUP: Remove markdown code blocks if present
            if "```" in result_json_str:
                import re
                # Remove ```json ... ``` or just ``` ... ```
                result_json_str = re.sub(r'^```json\s*', '', result_json_str)
                result_json_str = re.sub(r'^```\s*', '', result_json_str)
                result_json_str = re.sub(r'\s*```$', '', result_json_str)
                logging.info(f"[Sidecar] Cleaned JSON: {result_json_str}")

            duration = time.time() - start_time
            logging.info(f"[Sidecar] Analysis complete in {duration:.2f}s")

            # NEW: Parse scores and create cryptographically signed message
            try:
                scores = json.loads(result_json_str)

                # VALIDATION: Fix invalid dimension codes from LLM hallucination
                VALID_DIMS = {'S', 'C', 'O', 'P', 'E'}
                INVALID_TO_VALID = {
                    'HL': 'S',  # Map S.C.O.P.E. Coach dims to S.C.O.P.E.
                    'CM': 'C',
                    'DI': 'O',
                    'DL': 'P',
                    'PR': 'E',
                    'CO': 'S',  # Map Culture Coach dims to S.C.O.P.E.
                    'EP': 'E',
                    'DT': 'C',
                    'TR': 'O',
                    'CA': 'P'
                }
                DIM_ORDER = ['S', 'C', 'O', 'P', 'E']
                base_scores = [2.4, 2.5, 2.6, 2.5, 2.7]  # Slightly varied defaults

                # Fix dimensions object
                try:
                    if 'dimensions' in scores:
                        fixed_dims = {}
                        for dim, data in scores['dimensions'].items():
                            if dim in VALID_DIMS:
                                fixed_dims[dim] = data
                            elif dim in INVALID_TO_VALID:
                                mapped = INVALID_TO_VALID[dim]
                                logging.warning(f"[Sidecar] Fixed invalid dimension {dim} -> {mapped}")
                                fixed_dims[mapped] = data
                            else:
                                logging.warning(f"[Sidecar] Dropped unknown dimension: {dim}")

                        # Ensure all 5 valid dims exist with varied scores
                        for i, dim in enumerate(DIM_ORDER):
                            if dim not in fixed_dims:
                                fixed_dims[dim] = {'score': base_scores[i], 'confidence': 'LOW', 'evidenceCount': 0, 'trend': 'stable'}

                        # CRITICAL: Ensure scores are differentiated for trajectory chart
                        try:
                            all_scores = [fixed_dims[d].get('score', 2.5) for d in DIM_ORDER]
                            score_range = max(all_scores) - min(all_scores)

                            if score_range < 0.2:
                                logging.warning(f"[Sidecar] Scores too similar (range={score_range:.2f}), adding differentiation")
                                offsets = {'S': -0.12, 'C': 0.08, 'O': -0.04, 'P': 0.12, 'E': -0.04}
                                for dim in DIM_ORDER:
                                    old_score = fixed_dims[dim].get('score', 2.5)
                                    new_score = max(0, min(5, old_score + offsets[dim]))
                                    fixed_dims[dim]['score'] = round(new_score, 2)
                                logging.info(f"[Sidecar] Differentiated scores: {[fixed_dims[d]['score'] for d in DIM_ORDER]}")
                        except Exception as e:
                            logging.error(f"[Sidecar] Score differentiation error: {e}")

                        scores['dimensions'] = fixed_dims
                    else:
                        # No dimensions - create default
                        logging.warning("[Sidecar] No dimensions in response, creating defaults")
                        scores['dimensions'] = {
                            dim: {'score': base_scores[i], 'confidence': 'LOW', 'evidenceCount': 0, 'trend': 'stable'}
                            for i, dim in enumerate(DIM_ORDER)
                        }
                except Exception as e:
                    logging.error(f"[Sidecar] Dimension validation error: {e}")

                # Fix newEvidence dimension
                try:
                    if 'newEvidence' in scores and 'dimension' in scores['newEvidence']:
                        ev_dim = scores['newEvidence']['dimension']
                        if ev_dim not in VALID_DIMS:
                            if ev_dim in INVALID_TO_VALID:
                                scores['newEvidence']['dimension'] = INVALID_TO_VALID[ev_dim]
                                logging.warning(f"[Sidecar] Fixed evidence dimension {ev_dim} -> {INVALID_TO_VALID[ev_dim]}")
                            else:
                                scores['newEvidence']['dimension'] = 'S'
                except Exception as e:
                    logging.error(f"[Sidecar] Evidence validation error: {e}")

                tool_event = signer.create_signed_update(
                    scores=scores,
                    source='sidecar_groq' if 'kimi' not in GROQ_MODEL.lower() else 'sidecar_kimi',
                    model=GROQ_MODEL,
                    confidence=0.85,
                    reasoning=result_json_str[:200]
                )
                logging.info(f"[Sidecar] Created signed message with validated dimensions")
            except Exception as e:
                # GRACEFUL DEGRADATION: Fall back to old format if ANY error occurs
                logging.error(f"[Sidecar] Validation failed: {e}, using legacy format")
                tool_event = {
                    "type": "response.function_call_arguments.done",
                    "call_id": f"sidecar_{int(time.time())}",
                    "name": "updateAssessmentState",
                    "arguments": result_json_str
                }

            # Inject into client stream
            await websocket.send_text(json.dumps(tool_event))

        except Exception as e:
            logging.error(f"[Sidecar] Error: {e}")

    try:
        # Use websockets.connect (modern) instead of client.connect
        # Note: websockets 14+ uses 'additional_headers' instead of 'extra_headers'
        async with websockets.connect(openai_url, additional_headers=headers) as openai_ws:
            logging.info("Connected to OpenAI Realtime API")
            print("Connected to OpenAI Realtime API")

            # Task to forward messages from Client to OpenAI
            async def client_to_openai():
                try:
                    while True:
                        data = await websocket.receive_text()
                        msg = json.loads(data)

                        # NOTE: Tools are now passed through to OpenAI (not stripped)
                        # OpenAI will call updateAssessmentState directly like Culture Coach
                        if msg.get("type") == "session.update" and "session" in msg:
                            if "tools" in msg["session"]:
                                logging.info("[Relay] Passing tools to OpenAI for direct tool calling")

                        # INTERCEPT: Track User Audio Transcription (if available) or just rely on audio
                        # Note: Client sends 'input_audio_buffer.append'.
                        # We rely on Server VAD events to know when user spoke, but we need the TEXT.
                        # The server sends 'conversation.item.input_audio_transcription.completed'
                        # BUT only if we ask for it. We should ensure input_audio_transcription is enabled.

                        # If it's a session update, ensure transcription is on
                        if msg.get("type") == "session.update" and "session" in msg:
                             if "input_audio_transcription" not in msg["session"]:
                                 msg["session"]["input_audio_transcription"] = {"model": "whisper-1"}

                        await openai_ws.send(json.dumps(msg))
                except WebSocketDisconnect:
                    logging.info("Client disconnected")
                except Exception as e:
                    logging.error(f"Error in client_to_openai: {e}")

            # Task to forward messages from OpenAI to Client
            async def openai_to_client():
                try:
                    async for message in openai_ws:
                        msg = json.loads(message)

                        # TRACKING: Build History
                        if msg.get("type") == "conversation.item.input_audio_transcription.completed":
                            transcript = msg.get("transcript", "")
                            if transcript:
                                logging.info(f"[User]: {transcript}")
                                conversation_history.append({"role": "user", "content": transcript})
                                # Trigger Sidecar on User Turn
                                asyncio.create_task(run_sidecar_analysis(list(conversation_history)))

                        elif msg.get("type") == "response.audio_transcript.done":
                            transcript = msg.get("transcript", "")
                            if transcript:
                                logging.info(f"[AI]: {transcript}")
                                conversation_history.append({"role": "assistant", "content": transcript})

                        await websocket.send_text(message)
                except Exception as e:
                    logging.error(f"Error in openai_to_client: {e}")

            # Run both tasks
            await asyncio.gather(client_to_openai(), openai_to_client())

    except Exception as e:
        logging.error(f"OpenAI Connection Error: {e}")
        print(f"OpenAI Connection Error: {e}")
        # Send error to client if possible
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except:
            pass
        await websocket.close()
