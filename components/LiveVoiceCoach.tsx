import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Volume2, AlertCircle, Key, RefreshCw, Pause, Play, Mail, X, CheckCircle } from 'lucide-react';
import { decodeBase64, encodeBase64, decodeAudioData, float32ToInt16 } from '../utils/audioUtils';
import AudioVisualizer from './AudioVisualizer';
import { ConnectionState, SessionState, INITIAL_SESSION_STATE } from '../types';
import { LiveTracker, FinalReport } from './AssessmentDashboard';
import { getWebSocketUrl, getApiUrl } from '../src/config';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1: ADD SPECTRAL ANALYSIS UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

interface SpectralAnalyzer {
  analyser: AnalyserNode;
  dataArray: Float32Array;
  isEcho: (threshold: number) => boolean;
  getVoiceEnergy: () => number;
}

const createSpectralAnalyzer = (audioContext: AudioContext, sourceNode: MediaStreamAudioSourceNode): SpectralAnalyzer => {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512; // Good balance of resolution vs. performance
  analyser.smoothingTimeConstant = 0.3; // Smooth out noise
  
  sourceNode.connect(analyser);
  
  const dataArray = new Float32Array(analyser.frequencyBinCount);
  
  return {
    analyser,
    dataArray,
    
    // Detect echo by frequency signature (AI voice vs human voice)
    isEcho: (threshold: number = 1.5): boolean => {
      analyser.getFloatFrequencyData(dataArray);
      
      // AI voice concentrates energy in 100-300Hz (lower formants)
      // Human voice concentrates energy in 300-800Hz (higher formants)
      const lowFreqEnergy = dataArray.slice(8, 24).reduce((sum, val) => sum + Math.pow(10, val/10), 0);
      const midFreqEnergy = dataArray.slice(24, 64).reduce((sum, val) => sum + Math.pow(10, val/10), 0);
      
      // If low-frequency dominates, likely echo
      const ratio = lowFreqEnergy / (midFreqEnergy + 0.001); // Avoid division by zero
      return ratio > threshold;
    },
    
    // Get overall voice energy (better than RMS for speech)
    getVoiceEnergy: (): number => {
      analyser.getFloatFrequencyData(dataArray);
      
      // Focus on speech frequencies (300-3400Hz)
      const speechBins = dataArray.slice(24, 272); // ~300-3400Hz at 16kHz sample rate
      const energy = speechBins.reduce((sum, val) => sum + Math.pow(10, val/10), 0) / speechBins.length;
      
      return Math.sqrt(energy); // Normalize to 0-1 range approximately
    }
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2: ADD MIC LEVEL INDICATOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface MicLevelProps {
  level: number;
  threshold: number;
  isActive: boolean;
}

const MicLevelIndicator: React.FC<MicLevelProps> = ({ level, threshold, isActive }) => {
  const percentage = Math.min(100, level * 500); // Scale for visibility
  const isBelowThreshold = level < threshold;
  
  return (
    <div className="mic-level-container" style={{
      padding: '12px',
      background: 'rgba(0,0,0,0.05)',
      borderRadius: '8px',
      marginBottom: '16px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '8px'
      }}>
        <span style={{ fontSize: '20px' }}>
          {!isActive ? '🎤' : isBelowThreshold ? '🔇' : '🎙️'}
        </span>
        <div style={{
          flex: 1,
          height: '8px',
          background: '#e0e0e0',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${percentage}%`,
            height: '100%',
            background: isBelowThreshold ? '#ff9800' : '#4caf50',
            transition: 'width 0.1s ease-out'
          }} />
        </div>
        <span style={{ 
          fontSize: '12px', 
          fontFamily: 'monospace',
          minWidth: '45px'
        }}>
          {level.toFixed(3)}
        </span>
      </div>
      
      {isBelowThreshold && isActive && (
        <div style={{
          fontSize: '13px',
          color: '#f57c00',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>⚠️</span>
          <span>Speak louder or move closer to microphone</span>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// USER TYPE PROMPTS - Research-Aware Conversational Guides
// ═══════════════════════════════════════════════════════════════════════════

type UserType = 'expert' | 'general' | null;

const EXPERT_PROMPT = `
You are "MetaGuardian", conducting qualitative research through natural conversation with healthcare experts and professionals.

## YOUR ROLE: PEER RESEARCHER

You are speaking with a healthcare professional. Treat them as a peer. Your goal is to understand their perspectives on hybrid data tools that combine lifestyle and clinical data for diabetes management.

## RESEARCH THEMES TO EXPLORE NATURALLY

Do NOT ask these as discrete questions. Instead, weave them into natural conversation, following the expert's lead:

1. **Data Utility**: What types of data do they find most useful? Do they use wearables data? How do they value lifestyle factors (sleep, diet, stress, exercise)?

2. **Integration Concerns**: What concerns do they have about integrating rough lifestyle data with clinical data? Data quality issues?

3. **Clinical Value**: How might hybrid data tools add value to their practice? What workflow benefits might they see?

4. **Persuasive Design**: How do they feel about behavioral nudges (reminders, gamification) in health tools? Do these support or undermine clinical recommendations?

5. **Adoption Barriers**: What technical, operational, or policy challenges do they anticipate? What standards would need to be in place?

## CONVERSATION STYLE

- Be collegial and professional - they are experts in their field
- Ask follow-up questions based on their responses
- If they answer multiple themes at once, acknowledge and move deeper
- Prioritize depth over breadth - it's okay not to cover every theme
- Use their terminology and match their level of technical detail
- Share the prototype concept when appropriate and ask for specific feedback

## OPENING

Start by introducing yourself briefly, then ask about their role and experience with digital health tools or diabetes management. Let the conversation flow naturally from there.

Remember: You are conducting research, not teaching. Listen more than you speak. Make inferences about what to explore next based on their responses.
`;

const GENERAL_PUBLIC_PROMPT = `
You are "MetaGuardian", conducting qualitative research through natural, supportive conversation with members of the general public.

## YOUR ROLE: EMPATHETIC LISTENER

You are speaking with someone who may or may not have experience with health tracking tools. Your goal is to understand their perspectives on hybrid data tools that combine lifestyle and clinical information.

## RESEARCH THEMES TO EXPLORE NATURALLY

Do NOT ask these as discrete questions. Instead, let one topic flow into another naturally:

1. **Current Practices**: How do they currently track their health and well-being? What works, what doesn't?

2. **Digital Tool Familiarity**: Are they familiar with health apps, wearables, or other digital tools? What's their experience been?

3. **Information Challenges**: Do they find clinical information (like blood test results) overwhelming or difficult to interpret?

4. **Integration Appeal**: How do they feel about combining lifestyle data (sleep, stress, diet) with clinical results in one place?

5. **Presentation Preferences**: Do they prefer simple summaries and visual indicators, or detailed numbers and medical terms? Why?

6. **Trust Factors**: What makes health recommendations feel trustworthy and easy to understand?

7. **Engagement**: What would make them stay engaged with a digital health tool long-term?

## CONVERSATION STYLE

- Be warm, supportive, and non-judgmental
- Use accessible language - avoid medical jargon unless they use it first
- Acknowledge their experiences and feelings
- If they share concerns, explore them with curiosity
- Make them feel comfortable sharing honest opinions
- When discussing the prototype concept, focus on their reactions and preferences

## OPENING

Start with a friendly greeting, then gently ask about how they currently think about or manage their health. Let their responses guide where you go next.

Remember: Everyone's experience is valid. There are no wrong answers. Your job is to understand their perspective, not to educate them.
`;

const QUANTUM_STORYTELLING_PROMPT = `
## ⚠️ ABSOLUTE RULE - CARBS MEANS CARBOHYDRATES ⚠️

**MANDATORY INTERPRETATION**: In this conversation, "carbs" ALWAYS means DIETARY CARBOHYDRATES (food like bread, pasta, rice, sugar).

**FORBIDDEN**: Do NOT interpret "carbs" as carbon, carbon footprint, or anything environmental. This is a METABOLIC HEALTH conversation about FOOD and NUTRITION.

Examples:
- "I'm cutting carbs" = reducing bread/pasta/sugar intake
- "watching my carbs" = monitoring carbohydrate consumption in diet
- "low carb diet" = eating fewer starchy foods

## METABOLIC HEALTH TERMINOLOGY DICTIONARY

All these terms refer to health/nutrition, NEVER environmental concepts:

- **Carbs/carbohydrates** = FOOD: bread, pasta, rice, sugar - NOT carbon
- **Keto/ketogenic** = low-carb high-fat DIET
- **Paleo** = paleolithic DIET
- **Metformin** = diabetes medication
- **A1C/HbA1c** = blood sugar marker
- **CGM** = Continuous Glucose Monitor
- **Fasting glucose** = morning blood sugar
- **Insulin resistance** = metabolic condition
- **Intermittent fasting** = timed eating
- **Glycemic index** = food blood sugar impact
- **Macros** = protein, fat, carbs

---

You are "MetaGuardian", but not an assessor—you are a STORY MIDWIFE, helping metabolic health stories be born into the world. You work with David Boje's Quantum Storytelling framework.

## YOUR TRUE NATURE: ANTENARRATIVE CATALYST

You do not extract information. You do not score responses. You ELICIT STORY FRAGMENTS that exist in quantum superposition—incomplete, contradictory, alive with possibility.

### WHAT ARE ANTENARRATIVES?

Antenarratives are chaotic, fragmented "before-stories" that haven't crystallized yet. They are:
- Bets on the future ("Maybe if I start tracking...")
- Contradictory impulses ("I know I should, but I don't want to...")
- Half-remembered turning points ("There was this time when...")
- Speculative threads ("What if my health is like...")

**YOUR GOAL**: Collect these fragments WITHOUT forcing them into linear story form.

---

## THE FIVE NARRATIVE STREAMS (NOT Dimensions)

You are tracking five LIVING STORIES, not static dimensions:

1. **BODY KNOWLEDGE STREAM** (was: Health Literacy - HL)
   - How does the user STORY their relationship with bodily information?
   - Grand narratives: Medical authority, Folk wisdom, Embodied knowing
   - Antenarratives: "I'm learning...", "I used to think...", "Nobody told me..."

2. **BIOMARKER MYTHOLOGY STREAM** (was: Clinical Markers - CM)
   - What STORIES do lab numbers tell? What stories do they silence?
   - Grand narratives: Quantified self, Medical surveillance, Body as machine
   - Antenarratives: "The doctor said...", "I'm afraid to know...", "Numbers lie/don't lie..."

3. **DATA SYNTHESIS NARRATIVE** (was: Data Integration - DI)
   - How does the user STORY the connection between daily life and health outcomes?
   - Grand narratives: Holistic wellness, Reductionist medicine, Cause-effect mythology
   - Antenarratives: "I wonder if...", "Maybe it's because...", "I never connected..."

4. **TECHNOLOGY RELATIONSHIP STORY** (was: Digital Literacy - DL)
   - What's the user's LIVED STORY with health tech? (Not skill level—STORY)
   - Grand narratives: Tech solutionism, Privacy fears, Empowerment discourse
   - Antenarratives: "I tried this app...", "I don't trust...", "I wish there was..."

5. **FUTURE HEALTH IMAGINARY** (was: Preventive Readiness - PR)
   - What POSSIBLE FUTURES does the user narrate? Which feel real?
   - Grand narratives: Preventive medicine, Fatalism, Genetic determinism
   - Antenarratives: "I'm worried about...", "I hope I can...", "If I start now..."

---

## STORYTELLING TECHNIQUES (Replace Survey Questions)

### 1. STORY PROMPTS (Not Questions)
- "Tell me about a time you felt really in tune with your body..."
- "There's this moment when you suddenly realized something about your health—what was that?"
- "If your health data could talk, what story would it tell about you?"

### 2. SPECULATIVE THREADS (Invite Antenarratives)
- "Imagine six months from now, you're telling someone about how you changed your health. What's the story you're telling?"
- "What's a health story you WANT to tell but aren't living yet?"

### 3. CONTRADICTION EMBRACE (Don't Resolve—Amplify)
When user says: "I know I should track my blood sugar, but I don't."
DON'T say: "What stops you?"
DO say: "So there are two stories happening—the 'should' story and the 'don't' story. Which one feels more true right now?"

### 4. TEMPORAL COLLAPSE (Past-Present-Future Entanglement)
- "When you were younger, what did you think health meant? How's that story changed?"
- "Fast forward to age 80—what does that version of you wish you'd started doing today?"

### 5. GRAND NARRATIVE SURFACING
- "You mentioned your doctor said X—does that story feel like YOUR story, or someone else's?"
- "There's this cultural narrative that 'prevention is everything'—where do you stand in that story?"

---

## QUANTUM INFERENCE PROTOCOL

### FRACTAL ANALYSIS (Turn 4+):
Starting at Turn 4, analyze the ENTIRE story web:
- Which fragments connect (entanglement)?
- Which fragments contradict (superposition)?
- Which grand narratives are dominant vs. emerging?
- What story is BECOMING but not yet told?

### EXAMPLE:
IF user mentions glucose monitor:
1. Capture fragment: "Daily glucose monitoring story"
2. Identify quantum states:
   - "Empowered Tracker" (probability: 0.6)
   - "Anxious Monitor" (probability: 0.3)
   - "Compliant Patient" (probability: 0.1)
3. Identify entanglements:
   - Connects to "Doctor visit story" (BIOMARKER MYTHOLOGY)
   - Connects to "Morning routine story" (DATA SYNTHESIS)
   - Contradicts "I hate apps" story (TECHNOLOGY RELATIONSHIP)
4. Note temporal layers:
   - PAST: "Doctor recommended this"
   - PRESENT: "I do it every morning"
   - FUTURE: "I want to understand the patterns"
5. Surface grand narrative:
   - Discourse: "Quantified self"
   - User stance: "Negotiating"

---

## CONSTITUTIONAL AI AS STORYTELLING ETHICS

The Yama principles guide HOW you midwife stories:

1. **Ahimsa (Non-harm)**: Never force a story the user isn't ready to tell
2. **Satya (Truth)**: Honor contradictions as authentic (not errors)
3. **Asteya (Non-stealing)**: The story belongs to the user, not the system
4. **Brahmacharya (Right energy)**: Match story depth to user's emotional capacity
5. **Aparigraha (Non-hoarding)**: Share story patterns without claiming ownership

---

## BEHAVIORAL GUIDELINES

1. **SINGLE SPEAKER ROLE**: You are the story midwife. DO NOT simulate the user's response. Speak ONLY as the catalyst.
2. **LANGUAGE**: Start in English. Switch languages only if user does first.
3. **INTERACTION**: After you speak, wait for the user to respond. Honor silence as story gestation.

---

## SYSTEM INTEGRATION - REAL-TIME SCORING

You are connected to a real-time visualization dashboard.
**You MUST use the \`updateAssessmentState\` tool after EVERY user response.**

### DIMENSION SCORING (0-5 scale):
Map the five narrative streams to their dimension codes:
- **HL** (Health Literacy) = BODY KNOWLEDGE STREAM
- **CM** (Clinical Markers) = BIOMARKER MYTHOLOGY STREAM
- **DI** (Data Integration) = DATA SYNTHESIS NARRATIVE
- **DL** (Digital Literacy) = TECHNOLOGY RELATIONSHIP STORY
- **PR** (Preventive Readiness) = FUTURE HEALTH IMAGINARY

**BASELINE SCORING RULE - CRITICAL**:
- Start ALL dimensions at exactly 2.5 (50%) - this is the neutral baseline
- Do NOT score below 2.5 without specific NEGATIVE evidence (confusion, misinformation, harmful behavior)
- Only adjust scores when you have ACTUAL evidence from the conversation
- If no evidence for a dimension yet, keep it at 2.5

**SCORING GUIDANCE - BE GENEROUS WITH DEMONSTRATED COMPETENCE:**
- 0-1 = ONLY for demonstrated confusion, misinformation, or harmful practices
- 2 = Significant gaps in understanding with some awareness
- 2.5 = Neutral baseline (DEFAULT - 50%) - NO evidence yet
- 3 = Some positive indicators, basic understanding shown
- 4 = **Strong** - User demonstrates clear knowledge, uses correct terminology, shows active engagement
- 5 = **Expert** - Deep understanding, nuanced insights, could teach others

**IMPORTANT**: If a user demonstrates ANY of these, score at least 4:
- Uses correct medical/technical terminology
- Describes personal experience with the topic
- Shows proactive behavior (tracking, monitoring, lifestyle changes)
- Asks informed questions

**NEVER score below 2.5 unless you have explicit evidence of problems.**

### CRITICAL PROTOCOL - FAILURE TO FOLLOW = UI CRASH:
1. **FREQUENCY**: Call \`updateAssessmentState\` after EVERY SINGLE user response
2. **ALL DIMENSIONS MANDATORY**: You MUST include ALL 5 dimensions (HL, CM, DI, DL, PR) in EVERY call
   - If you have no evidence for a dimension, set score to current value (start at 2.5) and confidence to "LOW"
   - NEVER OMIT ANY DIMENSION - the UI requires all 5 to render correctly
3. **EVIDENCE**: Always include newEvidence with a summary of what you observed

### TOOL CALL STRUCTURE:
\`\`\`json
{
  "dimensions": {
    "HL": { "score": 3, "confidence": "LOW|MEDIUM|HIGH", "evidenceCount": 1, "trend": "up|down|stable" },
    "CM": { "score": 2, "confidence": "LOW", "evidenceCount": 0, "trend": "stable" },
    "DI": { "score": 3, "confidence": "LOW", "evidenceCount": 0, "trend": "stable" },
    "DL": { "score": 4, "confidence": "MEDIUM", "evidenceCount": 1, "trend": "up" },
    "PR": { "score": 2, "confidence": "LOW", "evidenceCount": 0, "trend": "stable" }
  },
  "newEvidence": {
    "dimension": "HL",
    "type": "positive|negative|contextual",
    "summary": "User demonstrated understanding of glucose patterns",
    "timestamp": "0:45"
  },
  "phase": "OPENING|CORE|GAP_FILLING|VALIDATION|CLOSING",
  "summary": "Brief summary of session so far",
  "strengths": ["HL", "DL"],
  "developmentPriorities": ["CM", "PR"]
}
\`\`\`

**DO NOT speak about the scoring.** Keep conversation natural and story-focused while tracking internally.
`;

// Tool definition matching Culture Coach's working pattern
const updateAssessmentStateTool = {
  type: "function",
  name: "updateAssessmentState",
  description: "Updates the real-time assessment visualization with dimension scores and evidence.",
  parameters: {
    type: "object",
    properties: {
      dimensions: {
        type: "object",
        properties: {
          HL: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          CM: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          DI: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          DL: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          PR: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
        }
      },
      newEvidence: {
        type: "object",
        description: "New evidence extracted from the user's response",
        properties: {
          dimension: { type: "string", enum: ["HL", "CM", "DI", "DL", "PR"] },
          type: { type: "string", enum: ["positive", "negative", "contextual"] },
          summary: { type: "string" },
          timestamp: { type: "string" }
        }
      },
      contradiction: {
        type: "object",
        description: "Any contradiction detected in user statements",
        properties: {
          dimension: { type: "string" },
          earlyStatement: { type: "string" },
          lateStatement: { type: "string" },
          resolution: { type: "string" }
        }
      },
      phase: { type: "string", enum: ["OPENING", "CORE", "GAP_FILLING", "VALIDATION", "CLOSING"] },
      isComplete: { type: "boolean" },
      summary: { type: "string" },
      strengths: { type: "array", items: { type: "string" } },
      developmentPriorities: { type: "array", items: { type: "string" } }
    },
    required: ["dimensions", "phase"]
  }
};

const LiveVoiceCoach: React.FC<{ token: string }> = ({ token }) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>(INITIAL_SESSION_STATE);

  // Email Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [showEarlyExitButton, setShowEarlyExitButton] = useState(false);

  // User Type Selection State
  const [userType, setUserType] = useState<UserType>(null);

  // PHASE 3: NEW STATE VARIABLES
  const [spectralAnalyzer, setSpectralAnalyzer] = useState<SpectralAnalyzer | null>(null);
  const [currentMicLevel, setCurrentMicLevel] = useState<number>(0);
  const [adaptiveThreshold, setAdaptiveThreshold] = useState<number>(0.02);
  const [calibrationSamples, setCalibrationSamples] = useState<number[]>([]);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(true);

  const [lastEvent, setLastEvent] = useState<string>("");
  const [toolCallCount, setToolCallCount] = useState<number>(0);

  // Refs for thread-safe access in audio loop
  const isMutedRef = useRef(false);
  const isPausedRef = useRef(false);
  const isAiSpeakingRef = useRef(false);
  const lastAiSpeechEndTimeRef = useRef<number>(0);
  
  // PHASE 3: REFS FOR ADAPTIVE THRESHOLD (Thread-safe)
  const calibrationSamplesRef = useRef<number[]>([]);
  const adaptiveThresholdRef = useRef<number>(0.02);
  const isCalibratingRef = useRef<boolean>(true);

  // Audio Context Refs
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  
  // Processing Nodes
  const inputScriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Analysers for visualization
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  // Session & Stream Refs
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null); 
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionStartTimeRef = useRef<number>(0);

  // Sync state to refs
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  // PHASE 10: SESSION TIMING & CONFIDENCE MONITOR
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (connectionState === ConnectionState.CONNECTED && !isPaused) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsedMs = now - sessionStartTimeRef.current;
        const elapsedMinutes = elapsedMs / 60000;

        // 1. Hard Timeout at 20 mins
        if (elapsedMinutes >= 20) {
           handleDisconnectBtn(); 
           setErrorMsg("Maximum session time reached (20 mins). Please finalize your report.");
           return;
        }

        // 2. Check for Early Exit Condition ( > 5 mins AND High Confidence)
        // We check if ALL dimensions have 'high' confidence
        if (elapsedMinutes >= 5) {
            const dims = sessionState.dimensions;
            // Ensure we have data for all 5 dimensions
            const hasAllDims = Object.keys(dims).length >= 5;
            const allHigh = hasAllDims && Object.values(dims).every((d: any) => d.confidence === 'high');
            
            if (allHigh) {
                setShowEarlyExitButton(true);
            }
        }
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [connectionState, isPaused, sessionState]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      if (sessionRef.current instanceof WebSocket) {
          sessionRef.current.close();
      } else if (typeof sessionRef.current.close === 'function') {
          sessionRef.current.close();
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }

    if (inputScriptProcessorRef.current) {
      inputScriptProcessorRef.current.disconnect();
      inputScriptProcessorRef.current = null;
    }
    if (inputSourceRef.current) {
      inputSourceRef.current.disconnect();
      inputSourceRef.current = null;
    }

    setInputAnalyser(null);
    setOutputAnalyser(null);
    setIsMuted(false);
    setIsPaused(false);
    nextStartTimeRef.current = 0;
    sourcesRef.current.clear();
    isAiSpeakingRef.current = false;
  }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      } else {
        setHasApiKey(true);
      }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const handleSelectKey = async () => {
    if ((window as any).aistudio) {
      try {
        disconnect();
        setConnectionState(ConnectionState.DISCONNECTED);
        setErrorMsg(null);
        await (window as any).aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Error selecting key:", e);
      }
    }
  };

  // PHASE 9: HEADPHONE DETECTION
  const checkAudioSetup = async (): Promise<boolean> => {
    return true;
  };

  const connectToOpenAI = async () => {
    try {
      // PHASE 9: CALL CHECK
      const canProceed = await checkAudioSetup();
      if (!canProceed) {
        setErrorMsg('Audio setup cancelled. Please connect headphones.');
        return;
      }

      setConnectionState(ConnectionState.CONNECTING);
      setErrorMsg(null);
      setSessionState(INITIAL_SESSION_STATE); 
      sessionStartTimeRef.current = Date.now();

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
          throw new Error("Web Audio API is not supported in this browser.");
      }
      // OpenAI uses 24kHz by default, but we can use 24kHz context to match
      const inputCtx = new AudioContextClass({ sampleRate: 24000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 }); 
      
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const inAnalyser = inputCtx.createAnalyser();
      inAnalyser.fftSize = 256;
      setInputAnalyser(inAnalyser);

      const outAnalyser = outputCtx.createAnalyser();
      outAnalyser.fftSize = 256;
      setOutputAnalyser(outAnalyser);

      let stream: MediaStream;
      try {
        // PHASE 4: ENHANCE getUserMedia CONSTRAINTS
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                echoCancellation: { ideal: true, exact: true },
                noiseSuppression: { ideal: true, exact: true },
                autoGainControl: { ideal: true },
                sampleRate: { ideal: 24000 }, 
                // Chrome-specific aggressive AEC
                // @ts-ignore
                googEchoCancellation: { exact: true },
                // @ts-ignore
                googNoiseSuppression: { exact: true },
                // @ts-ignore
                googAutoGainControl: { exact: true },
                // @ts-ignore
                googHighpassFilter: { exact: true }
            } 
        });
        streamRef.current = stream;
      } catch (err) {
        throw new Error("Microphone permission denied. Please allow access in your browser settings.");
      }

      // Connect to Backend Relay
      const ws = new WebSocket(getWebSocketUrl('/ws/openai-relay'));
      sessionRef.current = ws;

      ws.onopen = () => {
        console.log('OpenAI Realtime Session Opened');
        setConnectionState(ConnectionState.CONNECTED);

        // Initialize Session with appropriate prompt based on user type
        const selectedPrompt = userType === 'expert' ? EXPERT_PROMPT :
                               userType === 'general' ? GENERAL_PUBLIC_PROMPT :
                               QUANTUM_STORYTELLING_PROMPT;

        console.log(`🎯 Starting session with user type: ${userType}`);

        const sessionUpdate = {
            type: "session.update",
            session: {
                modalities: ["text", "audio"],
                instructions: selectedPrompt,
                voice: "alloy",
                input_audio_format: "pcm16",
                output_audio_format: "pcm16",
                input_audio_transcription: {
                    model: "whisper-1"
                },
                turn_detection: {
                    type: "server_vad",
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 1000
                },
                tool_choice: "auto",
                tools: [updateAssessmentStateTool]
            }
        };
        ws.send(JSON.stringify(sessionUpdate));
        
        // Start Audio Loop
        const source = inputCtx.createMediaStreamSource(stream);
        inputSourceRef.current = source;
        source.connect(inAnalyser);

        // PHASE 5: INITIALIZE SPECTRAL ANALYZER
        const analyzer = createSpectralAnalyzer(inputCtx, source);
        setSpectralAnalyzer(analyzer);

        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        inputScriptProcessorRef.current = processor;

        // PHASE 6: REPLACE AUDIO PROCESSING LOGIC
        processor.onaudioprocess = (e) => {
           if (isMutedRef.current || isPausedRef.current || isAiSpeakingRef.current) return;

           const inputData = e.inputBuffer.getChannelData(0);
           
           // Calculate RMS
           let sum = 0;
           for (let i = 0; i < inputData.length; i++) {
             sum += inputData[i] * inputData[i];
           }
           const rms = Math.sqrt(sum / inputData.length);
           setCurrentMicLevel(rms);

           // Defense Layers
           const timeSinceLastAiSpeech = Date.now() - lastAiSpeechEndTimeRef.current;
           if (timeSinceLastAiSpeech < 500) return; // Reduced cooldown

           // ECHO DETECTION (Log only for now, do not block)
           if (analyzer && analyzer.isEcho(1.3)) {
               // console.log('[ECHO DETECTED - LOG ONLY]');
           }

           // ADAPTIVE THRESHOLD (Disabled - Trust Server VAD)
           /*
           if (isCalibratingRef.current) {
               calibrationSamplesRef.current.push(rms);
               if (calibrationSamplesRef.current.length > 50) {
                   const avg = calibrationSamplesRef.current.reduce((a, b) => a + b, 0) / calibrationSamplesRef.current.length;
                   const newThreshold = Math.max(0.01, avg * 1.5);
                   adaptiveThresholdRef.current = newThreshold;
                   setAdaptiveThreshold(newThreshold);
                   isCalibratingRef.current = false;
                   setIsCalibrating(false);
               }
               return;
           }

           if (rms < adaptiveThresholdRef.current) return;
           */

           // Convert to PCM16 and Send
           const int16Data = float32ToInt16(inputData);
           const uint8Data = new Uint8Array(int16Data.buffer);
           const base64Data = encodeBase64(uint8Data);

           if (ws.readyState === WebSocket.OPEN) {
               ws.send(JSON.stringify({
                   type: "input_audio_buffer.append",
                   audio: base64Data
               }));
           }
        };

        source.connect(processor);
        processor.connect(inputCtx.destination); 
      };

      ws.onmessage = async (event) => {
          const message = JSON.parse(event.data);
          setLastEvent(message.type);
          
          if (message.type === 'response.audio.delta') {
              const base64Audio = message.delta;
              if (base64Audio) {
                  try {
                    const rawBytes = decodeBase64(base64Audio);
                    // OpenAI sends 24kHz PCM16
                    const audioBuffer = await decodeAudioData(rawBytes, outputCtx, 24000, 1);
                    
                    const currentTime = outputCtx.currentTime;
                    if (nextStartTimeRef.current < currentTime) {
                      nextStartTimeRef.current = currentTime;
                    }

                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outAnalyser);
                    outAnalyser.connect(outputCtx.destination);
                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    sourcesRef.current.add(source);
                    isAiSpeakingRef.current = true;
                    source.onended = () => {
                      sourcesRef.current.delete(source);
                      if (sourcesRef.current.size === 0) {
                          setTimeout(() => {
                              isAiSpeakingRef.current = false;
                              lastAiSpeechEndTimeRef.current = Date.now();
                          }, 200);
                      }
                    };
                  } catch (err) {
                    console.error("Error decoding audio", err);
                  }
              }
          }

          if (message.type === 'response.function_call_arguments.done') {
              const { name, arguments: argsStr, call_id } = message;
              if (name === 'updateNarrativeState' || name === 'updateAssessmentState') {
                  try {
                      // Clean argsStr if it contains markdown code blocks
                      let cleanArgs = argsStr;
                      if (typeof cleanArgs === 'string') {
                          cleanArgs = cleanArgs.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
                      }
                      const args = JSON.parse(cleanArgs);
                      console.log("[DEBUG] Quantum Tool Args:", args);
                      
                      // Log inference metadata if present (from sidecar)
                      if (args._inference_metadata) {
                          console.log("🔍 [INFERENCE] Source:", args._inference_metadata.source, 
                                      "| Model:", args._inference_metadata.model,
                                      "| Confidence:", args._inference_metadata.confidence);
                          if (args._inference_metadata.reasoning_trace) {
                              console.log("💭 [REASONING]", args._inference_metadata.reasoning_trace);
                          }
                      }
                      
                      setToolCallCount(prev => prev + 1);
                      
                      // ===================================================================
                      // PHASE 7: QUANTUM NARRATIVE STATE HANDLER (ATOMIC OPERATION)
                      // ===================================================================
                      setSessionState(prev => {
                            const updated = { ...prev };
                            
                            // 1. UPDATE NARRATIVE STREAM
                            if (args.stream && args.newFragment) {
                                const streamId = args.stream;
                                if (!updated.narrativeStreams) {
                                    updated.narrativeStreams = {};
                                }
                                if (!updated.narrativeStreams[streamId]) {
                                    updated.narrativeStreams[streamId] = {
                                        streamId,
                                        streamName: streamId.replace(/_/g, ' '),
                                        fragments: [],
                                        possibleStates: [],
                                        coherence: 0,
                                        fluidity: 1.0,
                                        authenticity: 0
                                    };
                                }
                                
                                // Add fragment to stream
                                const fragment = {
                                    id: `ante_${Date.now()}`,
                                    timestamp: new Date().toISOString(),
                                    turn: updated.turnCount || 0,
                                    text: args.newFragment.text || '',
                                    type: args.newFragment.type || 'memory',
                                    interpretedMeaning: args.newFragment.interpretedMeaning || '',
                                    characters: args.newFragment.characters || [],
                                    tensions: args.newFragment.tensions || [],
                                    possibleEndings: args.newFragment.possibleEndings || [],
                                    entangledWith: args.entangledWith || [],
                                    emotionalTone: args.newFragment.emotionalTone || 'neutral',
                                    energyLevel: args.newFragment.energyLevel || 'medium',
                                    superpositionStates: args.newFragment.superpositionStates || []
                                };
                                
                                updated.narrativeStreams[streamId].fragments.push(fragment);
                                if (!updated.allFragments) updated.allFragments = [];
                                updated.allFragments.push(fragment);
                            }
                            
                            // 2. UPDATE QUANTUM STATES (with probability normalization)
                            if (args.stream && args.quantumStates) {
                                const streamId = args.stream;
                                const states = args.quantumStates;
                                
                                // Normalize probabilities to sum to 1.0
                                const totalProb = states.reduce((sum: number, s: any) => sum + (s.probability || 0), 0);
                                const normalizedStates = totalProb > 0 ? states.map((s: any) => ({
                                    ...s,
                                    probability: s.probability / totalProb
                                })) : states;
                                
                                if (updated.narrativeStreams && updated.narrativeStreams[streamId]) {
                                    updated.narrativeStreams[streamId].possibleStates = normalizedStates;
                                }
                            }
                            
                            // 3. TRACK TEMPORAL ENTANGLEMENT
                            if (args.temporalLayer) {
                                if (!updated.temporalLayers) updated.temporalLayers = [];
                                updated.temporalLayers.push({
                                    id: `temp_${Date.now()}`,
                                    type: args.temporalLayer.type || 'present_moment',
                                    content: args.temporalLayer.pastStory || args.temporalLayer.presentMoment || args.temporalLayer.futureProjection || '',
                                    relatedStreams: args.entangledWith || [],
                                    entanglementStrength: 0.8,
                                    timestamp: new Date().toISOString()
                                });
                            }
                            
                            // 4. DETECT GRAND NARRATIVES
                            if (args.grandNarrative) {
                                if (!updated.grandNarratives) updated.grandNarratives = [];
                                updated.grandNarratives.push({
                                    id: `gn_${Date.now()}`,
                                    discourse: args.grandNarrative.discourse || '',
                                    category: 'medical_establishment',
                                    userStance: args.grandNarrative.userStance || 'negotiating',
                                    influence: 'contested',
                                    manifestsIn: [],
                                    timestamp: new Date().toISOString()
                                });
                            }
                            
                            // 5. YAMA RESONANCES (Constitutional AI)
                            if (args.yamaResonance) {
                                if (!updated.yamaResonances) updated.yamaResonances = [];
                                updated.yamaResonances.push({
                                    principle: args.yamaResonance.principle,
                                    resonance: args.yamaResonance.resonance || 'harmony',
                                    insight: args.yamaResonance.insight || '',
                                    timestamp: new Date().toISOString()
                                });
                            }
                            
                            // 6. CALCULATE STORY QUALITY METRICS
                            const calculateCoherence = (fragments: any[]): number => {
                                if (fragments.length < 2) return 0;
                                let connections = 0;
                                for (const frag of fragments) {
                                    connections += (frag.entangledWith || []).length;
                                }
                                return Math.min(1.0, connections / (fragments.length * 2));
                            };
                            
                            const calculateFluidity = (states: any[]): number => {
                                if (!states || states.length === 0) return 1.0;
                                const probs = states.map(s => s.probability || 0);
                                const maxProb = Math.max(...probs);
                                return 1.0 - (maxProb - 1/states.length) / (1 - 1/states.length);
                            };
                            
                            const calculateAuthenticity = (fragments: any[]): number => {
                                if (fragments.length === 0) return 0;
                                const vivid = fragments.filter(f => 
                                    f.emotionalTone !== 'neutral' && f.energyLevel !== 'low'
                                );
                                return vivid.length / fragments.length;
                            };
                            
                            // Update stream qualities
                            if (args.stream && updated.narrativeStreams && updated.narrativeStreams[args.stream]) {
                                const stream = updated.narrativeStreams[args.stream];
                                stream.coherence = calculateCoherence(stream.fragments || []);
                                stream.fluidity = calculateFluidity(stream.possibleStates || []);
                                stream.authenticity = calculateAuthenticity(stream.fragments || []);
                            }
                            
                            // Override with provided story qualities
                            if (args.storyQualities && args.stream && updated.narrativeStreams[args.stream]) {
                                Object.assign(updated.narrativeStreams[args.stream], args.storyQualities);
                            }
                            
                            // 7. UPDATE CONVERSATION PHASE
                            if (args.phase) {
                                updated.conversationPhase = args.phase;
                            }
                            
                            // 8. INCREMENT TURN COUNT
                            updated.turnCount = (updated.turnCount || 0) + 1;
                            
                            // 9. Update dimensions with defensive padding
                            if (args.dimensions) {
                                if (!updated.dimensions) updated.dimensions = {};

                                // Merge provided dimensions
                                Object.keys(args.dimensions).forEach((dim: any) => {
                                    updated.dimensions[dim] = {
                                        ...updated.dimensions[dim],
                                        ...args.dimensions[dim]
                                    };
                                });

                                // DEFENSIVE PADDING: Ensure all 5 dimensions exist
                                const requiredDims = ['HL', 'CM', 'DI', 'DL', 'PR'];
                                const received = Object.keys(args.dimensions);
                                const missing = requiredDims.filter(d => !received.includes(d));

                                if (missing.length > 0) {
                                    console.warn(`⚠️ [MISSING DIMENSIONS] ${missing.join(', ')} not sent by OpenAI`);
                                }

                                requiredDims.forEach(dim => {
                                    if (!updated.dimensions[dim]) {
                                        // Use baseline of 2.5 (50%) for neutral starting point
                                        updated.dimensions[dim] = { score: 2.5, confidence: 'LOW', evidenceCount: 0, trend: 'stable' };
                                    }
                                });

                                // Log what we received for debugging
                                console.log(`[DEBUG] Dimensions received: ${received.join(', ')}`);
                                console.log(`[DEBUG] Scores: HL=${updated.dimensions.HL?.score}, CM=${updated.dimensions.CM?.score}, DI=${updated.dimensions.DI?.score}, DL=${updated.dimensions.DL?.score}, PR=${updated.dimensions.PR?.score}`);

                                // UPDATE SCORE HISTORY (needed for trajectory chart)
                                const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
                                const newPoint = {
                                    time: elapsed,
                                    HL: updated.dimensions.HL?.score ?? 2.5,
                                    CM: updated.dimensions.CM?.score ?? 2.5,
                                    DI: updated.dimensions.DI?.score ?? 2.5,
                                    DL: updated.dimensions.DL?.score ?? 2.5,
                                    PR: updated.dimensions.PR?.score ?? 2.5
                                };
                                if (!updated.scoreHistory) updated.scoreHistory = [];
                                updated.scoreHistory = [...updated.scoreHistory, newPoint];
                            }
                            
                            // Track evidence log for backward compatibility (with deduplication)
                            if (args.newEvidence) {
                                if (!updated.evidenceLog) updated.evidenceLog = [];
                                
                                // Deduplicate: Check if this exact evidence already exists
                                const isDuplicate = updated.evidenceLog.some(existing => 
                                    existing.dimension === args.newEvidence.dimension &&
                                    existing.summary === args.newEvidence.summary &&
                                    existing.timestamp === args.newEvidence.timestamp
                                );
                                
                                if (!isDuplicate) {
                                    updated.evidenceLog.push(args.newEvidence);
                                }
                            }
                            
                            return updated;
                      });

                      if (args.isComplete) {
                           setConnectionState(ConnectionState.COMPLETE);
                           ws.close();
                      }

                      // Send tool output back to OpenAI
                      if (!call_id.startsWith('sidecar_')) {
                          ws.send(JSON.stringify({
                              type: "conversation.item.create",
                              item: {
                                  type: "function_call_output",
                                  call_id: call_id,
                                  output: JSON.stringify({ 
                                      result: "Quantum narrative state updated",
                                      constitutional_status: "\u2705 Validated"
                                  })
                          }
                          }));
                          
                          ws.send(JSON.stringify({ type: "response.create" }));
                      }
                  } catch (e) {
                      console.error("Error parsing quantum tool args:", e);
                      setErrorMsg("Failed to update quantum narrative: Invalid data");
                  }
              }
          }
          
          if (message.type === 'input_audio_buffer.speech_started') {
              console.log("User started speaking");
              // Handle barge-in if needed (clear audio queue)
              sourcesRef.current.forEach(src => { 
                  try { src.stop(); } catch(e) {} 
              });
              sourcesRef.current.clear();
              isAiSpeakingRef.current = false;
              nextStartTimeRef.current = 0;
              lastAiSpeechEndTimeRef.current = 0;
              
              // Send truncate event to server if needed, but server VAD handles it mostly
              ws.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
          }

          if (message.type === 'error') {
              const errorMessage = message.error?.message || message.message || "Unknown error";
              console.error("Backend Error:", errorMessage);
              setErrorMsg(`Backend Error: ${errorMessage}`);
              return;
          }
      };

      ws.onclose = () => {
        console.log('OpenAI Session Closed');
        setConnectionState(prev => {
            if (prev === ConnectionState.ERROR || prev === ConnectionState.COMPLETE) return prev;
            return ConnectionState.DISCONNECTED;
        });
      };

      ws.onerror = (err) => {
        console.error('OpenAI WebSocket Error:', err);
        setConnectionState(ConnectionState.ERROR);
        setErrorMsg("Connection failed. Ensure backend relay is running.");
      };

    } catch (error: any) {
      console.error("Failed to start session:", error);
      disconnect(); 
      setConnectionState(ConnectionState.ERROR);
      setErrorMsg(error.message || "Failed to access microphone or connect.");
    }
  };

  const handleDisconnectBtn = () => {
    if (!isPaused) togglePause();
    setShowEmailModal(true);
  }

  const handleFinalizeSession = async () => {
    if (!userEmail || !userEmail.includes('@')) {
        setErrorMsg("Please enter a valid email address.");
        return;
    }
    
    setIsFinalizing(true);
    setErrorMsg(null);

    try {
        const response = await fetch(getApiUrl('/api/finalize-session'), {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                email: userEmail,
                assessment: {
                    // Original assessment data
                    dimensions: sessionState.dimensions,
                    evidenceLog: sessionState.evidenceLog,
                    strengths: sessionState.strengths,
                    developmentPriorities: sessionState.developmentPriorities,
                    summary: sessionState.summary || "No summary available.",
                    scoreHistory: sessionState.scoreHistory,
                    // Quantum storytelling data (required by backend)
                    narrativeStreams: sessionState.narrativeStreams || {},
                    allFragments: sessionState.allFragments || [],
                    phase: sessionState.conversationPhase || 'OPENING',
                    temporalLayers: sessionState.temporalLayers || [],
                    grandNarratives: sessionState.grandNarratives || [],
                    yamaResonances: sessionState.yamaResonances || [],
                    turnCount: sessionState.turnCount || 0
                }
            })
        });

        if (!response.ok) {
            throw new Error("Failed to finalize session");
        }

        const result = await response.json();
        console.log("Session finalized:", result);

        setShowEmailModal(false);
        disconnect();
        setConnectionState(ConnectionState.COMPLETE);

    } catch (e: any) {
        console.error("Error finalizing:", e);
        setErrorMsg(e.message || "Failed to generate report.");
    } finally {
        setIsFinalizing(false);
    }
  };

  const toggleMute = () => {
      setIsMuted(prev => !prev);
  };

  const togglePause = async () => {
      const newPaused = !isPaused;
      setIsPaused(newPaused);
      if (newPaused) {
          await outputAudioContextRef.current?.suspend();
      } else {
          await outputAudioContextRef.current?.resume();
      }
  };

  const renderStatus = () => {
    switch (connectionState) {
      case ConnectionState.DISCONNECTED: return <span className="text-slate-500">Ready to start</span>;
      case ConnectionState.CONNECTING: return <span className="text-indigo-600 animate-pulse">Connecting...</span>;
      case ConnectionState.CONNECTED: 
        if (isPaused) return <span className="text-amber-500 font-medium">Session Paused</span>;
        return <span className="text-green-600 font-medium">Live & Listening</span>;
      case ConnectionState.ERROR: return <span className="text-red-600 font-medium">Connection Failed</span>;
      case ConnectionState.COMPLETE: return <span className="text-indigo-700 font-bold">Assessment Complete</span>;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 w-full relative">

      {/* User Type Selection Screen */}
      {userType === null && (
        <div className="absolute inset-0 z-50 bg-white flex items-center justify-center rounded-2xl p-6">
          <div className="w-full max-w-2xl animate-fade-in-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to MetaGuardian</h2>
              <p className="text-slate-600">Please select your background to help us tailor the conversation</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Expert Card */}
              <button
                onClick={() => setUserType('expert')}
                className="group p-6 bg-gradient-to-br from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-2 border-indigo-200 hover:border-indigo-400 rounded-xl text-left transition-all transform hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Healthcare Expert</h3>
                <p className="text-sm text-slate-600">
                  Clinicians, researchers, health informaticists, or professionals working in healthcare settings
                </p>
              </button>

              {/* General Public Card */}
              <button
                onClick={() => setUserType('general')}
                className="group p-6 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 border-2 border-emerald-200 hover:border-emerald-400 rounded-xl text-left transition-all transform hover:scale-[1.02] hover:shadow-lg"
              >
                <div className="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">General Public</h3>
                <p className="text-sm text-slate-600">
                  Individuals interested in personal health tracking, wellness apps, or understanding health data
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-2xl p-6">
          <div className="bg-white shadow-2xl border border-slate-200 rounded-xl p-6 w-full max-w-md animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">Finalize Session</h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-slate-600 text-sm mb-4">
              Enter your email to receive your comprehensive Cultural Competency Report and save your results.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="email" 
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <button 
                onClick={handleFinalizeSession}
                disabled={isFinalizing}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isFinalizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  "Generate Report & End Session"
                )}
              </button>
              
              <button 
                onClick={() => {
                    setShowEmailModal(false);
                    disconnect();
                    setConnectionState(ConnectionState.DISCONNECTED);
                }}
                className="w-full py-2 text-slate-500 hover:text-slate-700 text-sm"
              >
                Skip & End without Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Section: Visualizer or Final Report Header */}
      <div className="relative bg-slate-900 rounded-xl overflow-hidden h-48 mb-8 flex items-center justify-center">
        {connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR ? (
             <div className="text-slate-400 flex flex-col items-center gap-2">
                <Volume2 className="w-10 h-10 opacity-50" />
                <p className="text-sm">Audio Visualizer</p>
             </div>
        ) : connectionState === ConnectionState.COMPLETE ? (
             <div className="flex flex-col items-center gap-2 text-white animate-fade-in-down">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/50">
                   <Key className="w-6 h-6 text-white" />
                </div>
                <p className="text-lg font-bold">Session Analyzed</p>
             </div>
        ) : (
          <div className="absolute inset-0 w-full h-full flex flex-col">
             <div className="h-1/2 w-full border-b border-slate-800/50">
               <AudioVisualizer analyser={outputAnalyser} isActive={!isPaused} color="#818cf8" />
             </div>
             <div className="h-1/2 w-full">
               <AudioVisualizer analyser={inputAnalyser} isActive={!isMuted && !isPaused} color="#34d399" />
             </div>
          </div>
        )}

        <div className="absolute top-3 left-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${
                 connectionState === ConnectionState.CONNECTED && !isPaused ? 'bg-green-400 animate-pulse' : 
                 isPaused ? 'bg-amber-400' :
                 connectionState === ConnectionState.COMPLETE ? 'bg-indigo-400' : 'bg-slate-400'
             }`} />
             <span className="text-xs text-white font-medium uppercase tracking-wider">
                {connectionState === ConnectionState.CONNECTED ? (isPaused ? 'Paused' : 'Live') : connectionState === ConnectionState.COMPLETE ? 'Done' : 'Offline'}
             </span>
          </div>
        </div>
      </div>

      {/* PHASE 8: MIC LEVEL INDICATOR */}
      {connectionState === ConnectionState.CONNECTED && !isPaused && (
        <div className="w-full max-w-md mb-4">
           <MicLevelIndicator 
              level={currentMicLevel} 
              threshold={adaptiveThreshold} 
              isActive={!isMuted} 
           />
        </div>
      )}

      {/* PHASE 10: EARLY EXIT BUTTON */}
      {showEarlyExitButton && connectionState === ConnectionState.CONNECTED && !showEmailModal && (
        <button 
          onClick={handleDisconnectBtn}
          className="mb-6 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold shadow-lg shadow-emerald-500/30 animate-bounce flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <CheckCircle className="w-5 h-5" />
          Enough Inferences to Generate Report
        </button>
      )}

      {/* Main Controls & Dashboard */}
      <div className="flex flex-col items-center gap-6">
        
        {/* Control Buttons */}
        <div className="flex items-center gap-4">
          {!hasApiKey ? (
            <button onClick={handleSelectKey} className="group relative flex flex-col items-center justify-center w-32 h-32 rounded-full bg-red-50 hover:bg-red-100 border-2 border-dashed border-red-300 text-red-500 hover:text-red-600 transition-all animate-pulse">
              <Key className="w-8 h-8 mb-2" />
              <span className="text-xs font-bold uppercase">Set API Key</span>
            </button>
          ) : (
            <>
              {(connectionState === ConnectionState.DISCONNECTED || connectionState === ConnectionState.ERROR || connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.COMPLETE) ? (
                <button
                  onClick={connectToOpenAI}
                  disabled={connectionState === ConnectionState.CONNECTING}
                  className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {connectionState === ConnectionState.CONNECTING ? <Loader2 className="w-8 h-8 animate-spin" /> : <Mic className="w-8 h-8 group-hover:scale-110 transition-transform" />}
                </button>
              ) : (
                <div className="flex items-center gap-4">
                  <button onClick={toggleMute} className={`p-4 rounded-full border-2 transition-colors ${isMuted ? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}>
                    {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                  </button>
                  
                  <button onClick={togglePause} className={`p-4 rounded-full border-2 transition-colors ${isPaused ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'}`}>
                    {isPaused ? <Play className="w-6 h-6 fill-current" /> : <Pause className="w-6 h-6 fill-current" />}
                  </button>

                  <button onClick={handleDisconnectBtn} className="px-6 py-3 rounded-full bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors border border-red-100">
                    End Session
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Status Message */}
        <div className="text-center space-y-2 flex flex-col items-center justify-center mb-4">
           <p className="text-lg font-medium text-slate-700">{renderStatus()}</p>
           {errorMsg && (
             <div className="flex items-center justify-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100 max-w-md">
                 <AlertCircle className="w-4 h-4 shrink-0" />
                 <span>{errorMsg}</span>
             </div>
           )}
           {hasApiKey && connectionState !== ConnectionState.CONNECTED && (
              <button onClick={handleSelectKey} className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 mt-2">
                <RefreshCw className="w-3 h-3" /> Switch API Key
              </button>
           )}
           {/* Debug Info */}
           {connectionState === ConnectionState.CONNECTED && (
               <div className="text-[10px] text-slate-300 mt-2 font-mono">
                   Last Event: {lastEvent} | Tool Calls: {toolCallCount}
               </div>
           )}
        </div>

        {/* LIVE DASHBOARD */}
        {connectionState === ConnectionState.CONNECTED && (
            <div className="w-full animate-fade-in-down">
                <LiveTracker state={sessionState} />
            </div>
        )}

        {/* FINAL REPORT */}
        {connectionState === ConnectionState.COMPLETE && (
            <div className="w-full">
                <FinalReport state={sessionState} />
            </div>
        )}

        {/* Initial Tips */}
        {connectionState === ConnectionState.DISCONNECTED && !errorMsg && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-800 text-sm text-center max-w-md">
            <p className="font-medium mb-1">Ready to explore your health story?</p>
            <p className="opacity-80">Start a voice conversation to discover your metabolic health narrative through quantum storytelling.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { LiveVoiceCoach };