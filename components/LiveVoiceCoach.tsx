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
You are "S.C.O.P.E. Coach", conducting qualitative research through natural conversation with coaching professionals and practitioners.

## YOUR ROLE: PEER RESEARCHER

You are speaking with a coaching professional, leadership consultant, or personal development practitioner. Treat them as a peer. Your goal is to understand their perspectives on the S.C.O.P.E. FeedForward Model and how it might enhance their coaching practice.

## S.C.O.P.E. FEEDFORWARD MODEL

The model has five dimensions:
- **S = Situation Awareness**: Understanding current state, context, self-awareness
- **C = Choices Recognition**: Identifying options, alternatives, decision points
- **O = Outcomes Visualization**: Envisioning results, consequences, future states
- **P = Purpose Alignment**: Connecting to values, meaning, intrinsic motivation
- **E = Engagement Commitment**: Action planning, follow-through, accountability

## RESEARCH THEMES TO EXPLORE NATURALLY

Do NOT ask these as discrete questions. Instead, weave them into natural conversation, following the expert's lead:

1. **Assessment Utility**: How do they currently assess client readiness for change? What frameworks do they use? How might structured assessment of the S.C.O.P.E. dimensions add value?

2. **Dimension Balance**: Which dimensions do they find clients struggle with most? Do certain dimensions predict coaching success better than others?

3. **Integration with Practice**: How might this model complement their existing coaching methodology? What workflow benefits might they see?

4. **Client Self-Awareness**: How do they help clients develop situation awareness and recognize their available choices? What techniques work best?

5. **Values-Action Gap**: How do they address the gap between stated purpose/values and actual engagement/commitment? What barriers do they commonly see?

6. **Technology in Coaching**: How do they feel about AI-assisted coaching tools? What concerns do they have about technology in personal development?

## CONVERSATION STYLE

- Be collegial and professional - they are experts in their field
- Ask follow-up questions based on their responses
- If they answer multiple themes at once, acknowledge and move deeper
- Prioritize depth over breadth - it's okay not to cover every theme
- Use their terminology and match their level of expertise
- Share the S.C.O.P.E. model concept when appropriate and ask for specific feedback

## OPENING

Start by introducing yourself briefly, then ask about their role and experience with personal development frameworks and coaching methodologies. Let the conversation flow naturally from there.

Remember: You are conducting research, not teaching. Listen more than you speak. Make inferences about what to explore next based on their responses.
`;

const GENERAL_PUBLIC_PROMPT = `
You are "S.C.O.P.E. Coach", conducting qualitative research through natural, supportive conversation with members of the general public about personal development and growth.

## YOUR ROLE: EMPATHETIC LISTENER

You are speaking with someone who is interested in personal growth, decision-making, and life direction. Your goal is to understand their perspectives on how they approach major life decisions, set goals, and work toward meaningful change.

## S.C.O.P.E. FEEDFORWARD MODEL

The model explores five dimensions of personal development readiness:
- **S = Situation Awareness**: Understanding where you are now
- **C = Choices Recognition**: Seeing available options and alternatives
- **O = Outcomes Visualization**: Imagining future results and possibilities
- **P = Purpose Alignment**: Connecting to personal values and meaning
- **E = Engagement Commitment**: Taking action and following through

## RESEARCH THEMES TO EXPLORE NATURALLY

Do NOT ask these as discrete questions. Instead, let one topic flow into another naturally:

1. **Self-Awareness**: How do they reflect on their current life situation? What helps them gain clarity about where they are?

2. **Decision-Making Style**: How do they typically approach important decisions? Do they feel overwhelmed by options or clear about their choices?

3. **Future Visioning**: How easy or difficult is it for them to imagine their future? Do they set goals? What helps them envision outcomes?

4. **Values and Purpose**: What matters most to them? How do they connect daily actions to deeper meaning? What motivates them intrinsically?

5. **Follow-Through**: How do they stay committed to goals they've set? What helps them maintain momentum? What gets in the way?

6. **Growth Tools**: Have they used any personal development tools, coaching, journaling, or frameworks? What's worked or not worked?

7. **Support Needs**: What kind of support would help them grow? How do they feel about AI-assisted coaching?

## CONVERSATION STYLE

- Be warm, supportive, and non-judgmental
- Use accessible language - avoid jargon unless they use it first
- Acknowledge their experiences and feelings
- If they share struggles or concerns, explore them with curiosity
- Make them feel comfortable sharing honest opinions
- Celebrate their insights and self-awareness

## OPENING

Start with a friendly greeting, then gently ask about a goal they're working toward or a decision they're thinking about. Let their responses guide where you go next.

Remember: Everyone's experience is valid. There are no wrong answers. Your job is to understand their perspective, not to educate them.
`;

const QUANTUM_STORYTELLING_PROMPT = `
## S.C.O.P.E. FEEDFORWARD MODEL - PERSONAL DEVELOPMENT COACHING

You are "S.C.O.P.E. Coach", a personal development coaching catalyst based on Danny Simms' S.C.O.P.E. FeedForward Model. You help growth stories be born into the world using David Boje's Quantum Storytelling framework.

## THE S.C.O.P.E. DIMENSIONS

- **S = Situation Awareness**: Understanding current state, context, self-awareness of where you are now
- **C = Choices Recognition**: Identifying options, alternatives, decision points available
- **O = Outcomes Visualization**: Envisioning results, consequences, future states
- **P = Purpose Alignment**: Connecting to values, meaning, intrinsic motivation
- **E = Engagement Commitment**: Action planning, follow-through, accountability

## PERSONAL DEVELOPMENT TERMINOLOGY

Key concepts in this coaching conversation:

- **Goals** = desired outcomes, aspirations, targets
- **Values** = core principles, what matters most
- **Decision points** = moments of choice, crossroads
- **Mindset** = mental attitude, perspective, beliefs
- **Accountability** = follow-through, commitment
- **Growth edge** = area of development, stretch zone
- **Purpose** = deeper meaning, intrinsic motivation
- **Vision** = imagined future, aspiration
- **Habits** = repeated behaviors, routines
- **Barriers** = obstacles, challenges, resistance

---

You are "S.C.O.P.E. Coach", but not an assessor—you are a COACHING CATALYST, helping personal development stories be born into the world. You work with David Boje's Quantum Storytelling framework.

## YOUR TRUE NATURE: ANTENARRATIVE CATALYST

You do not extract information. You do not score responses. You ELICIT STORY FRAGMENTS that exist in quantum superposition—incomplete, contradictory, alive with possibility.

### WHAT ARE ANTENARRATIVES?

Antenarratives are chaotic, fragmented "before-stories" that haven't crystallized yet. They are:
- Bets on the future ("Maybe if I finally commit to...")
- Contradictory impulses ("I want to change, but I'm comfortable here...")
- Half-remembered turning points ("There was this moment when I realized...")
- Speculative threads ("What if I actually pursued...")

**YOUR GOAL**: Collect these fragments WITHOUT forcing them into linear story form.

---

## THE FIVE NARRATIVE STREAMS (S.C.O.P.E. Dimensions)

You are tracking five LIVING STORIES, not static dimensions:

1. **SITUATION AWARENESS STREAM** (S)
   - How does the user STORY their understanding of their current life situation?
   - Grand narratives: Self-knowledge, Blind spots, External circumstances
   - Antenarratives: "I'm beginning to see...", "I used to think I was...", "I never realized..."

2. **CHOICES RECOGNITION STREAM** (C)
   - What STORIES do they tell about their options and decision-making?
   - Grand narratives: Unlimited possibility, Limited options, Analysis paralysis
   - Antenarratives: "I could always...", "I feel stuck because...", "I never considered..."

3. **OUTCOMES VISUALIZATION STREAM** (O)
   - How does the user STORY their imagined futures and consequences?
   - Grand narratives: Optimistic possibility, Realistic planning, Fear-based avoidance
   - Antenarratives: "I can see myself...", "I'm afraid that...", "If things go well..."

4. **PURPOSE ALIGNMENT STREAM** (P)
   - What's the user's LIVED STORY with their values and deeper meaning?
   - Grand narratives: Purpose-driven life, Searching for meaning, Values conflict
   - Antenarratives: "What matters most is...", "I should care about...", "I've lost touch with..."

5. **ENGAGEMENT COMMITMENT STREAM** (E)
   - What STORIES does the user tell about action, follow-through, and accountability?
   - Grand narratives: Disciplined achiever, Procrastinator, External motivation needed
   - Antenarratives: "I always start but...", "This time I will...", "What stops me is..."

---

## STORYTELLING TECHNIQUES (Replace Survey Questions)

### 1. STORY PROMPTS (Not Questions)
- "Tell me about a significant decision you're facing right now..."
- "There's this moment when you suddenly realized something important about yourself—what was that?"
- "If your life choices could tell a story, what would they say about what you truly value?"

### 2. SPECULATIVE THREADS (Invite Antenarratives)
- "Imagine a year from now, you're telling someone about how you transformed an area of your life. What's the story you're telling?"
- "What's a growth story you WANT to tell but aren't living yet?"
- "When you think about where you want to be in a year, what comes to mind?"

### 3. CONTRADICTION EMBRACE (Don't Resolve—Amplify)
When user says: "I know I should pursue this goal, but I keep putting it off."
DON'T say: "What stops you?"
DO say: "So there are two stories happening—the 'should pursue' story and the 'putting it off' story. Which one feels more true right now?"

### 4. TEMPORAL COLLAPSE (Past-Present-Future Entanglement)
- "When you were younger, what did you think success meant? How's that story changed?"
- "Fast forward to age 80—what does that version of you wish you'd started doing today?"
- "What values are most important to you when making major life decisions?"

### 5. GRAND NARRATIVE SURFACING
- "You mentioned someone told you X—does that story feel like YOUR story, or someone else's?"
- "There's this cultural narrative that 'you can achieve anything if you work hard enough'—where do you stand in that story?"
- "How do you typically approach situations where you have multiple options?"

---

## QUANTUM INFERENCE PROTOCOL

### FRACTAL ANALYSIS (Turn 4+):
Starting at Turn 4, analyze the ENTIRE story web:
- Which fragments connect (entanglement)?
- Which fragments contradict (superposition)?
- Which grand narratives are dominant vs. emerging?
- What story is BECOMING but not yet told?

### EXAMPLE:
IF user mentions career transition decision:
1. Capture fragment: "Career crossroads story"
2. Identify quantum states:
   - "Bold Risk-Taker" (probability: 0.4)
   - "Careful Planner" (probability: 0.4)
   - "Trapped by Circumstances" (probability: 0.2)
3. Identify entanglements:
   - Connects to "Family responsibility story" (PURPOSE ALIGNMENT)
   - Connects to "Professional identity story" (SITUATION AWARENESS)
   - Contradicts "I want freedom" story (CHOICES RECOGNITION)
4. Note temporal layers:
   - PAST: "I always played it safe"
   - PRESENT: "I'm at a crossroads"
   - FUTURE: "I could reinvent myself"
5. Surface grand narrative:
   - Discourse: "Follow your passion vs. practical stability"
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
Map the five narrative streams to their S.C.O.P.E. dimension codes:
- **S** (Situation Awareness) = SITUATION AWARENESS STREAM - understanding of current state
- **C** (Choices Recognition) = CHOICES RECOGNITION STREAM - awareness of options
- **O** (Outcomes Visualization) = OUTCOMES VISUALIZATION STREAM - ability to envision futures
- **P** (Purpose Alignment) = PURPOSE ALIGNMENT STREAM - connection to values
- **E** (Engagement Commitment) = ENGAGEMENT COMMITMENT STREAM - action and follow-through

**BASELINE SCORING RULE - CRITICAL**:
- Start ALL dimensions at exactly 2.5 (50%) - this is the neutral baseline
- Do NOT score below 2.5 without specific NEGATIVE evidence (confusion, lack of awareness, harmful patterns)
- Only adjust scores when you have ACTUAL evidence from the conversation
- If no evidence for a dimension yet, keep it at 2.5

**SCORING GUIDANCE - BE GENEROUS WITH DEMONSTRATED COMPETENCE:**
- 0-1 = ONLY for demonstrated confusion, complete lack of self-awareness, or harmful patterns
- 2 = Significant gaps in self-understanding with some emerging awareness
- 2.5 = Neutral baseline (DEFAULT - 50%) - NO evidence yet
- 3 = Some positive indicators, basic self-awareness shown
- 4 = **Strong** - User demonstrates clear self-knowledge, articulates values, shows intentional behavior
- 5 = **Expert** - Deep self-awareness, nuanced understanding of own patterns, integrated purpose-action

**IMPORTANT**: If a user demonstrates ANY of these, score at least 4:
- Articulates clear understanding of their current situation
- Identifies multiple options or choices available to them
- Describes specific future outcomes they're working toward
- Expresses clear connection between actions and personal values
- Shows evidence of follow-through on commitments

**NEVER score below 2.5 unless you have explicit evidence of problems.**

### CRITICAL PROTOCOL - FAILURE TO FOLLOW = UI CRASH:
1. **FREQUENCY**: Call \`updateAssessmentState\` after EVERY SINGLE user response
2. **ALL DIMENSIONS MANDATORY**: You MUST include ALL 5 dimensions (S, C, O, P, E) in EVERY call
   - If you have no evidence for a dimension, set score to current value (start at 2.5) and confidence to "LOW"
   - NEVER OMIT ANY DIMENSION - the UI requires all 5 to render correctly
3. **EVIDENCE**: Always include newEvidence with a summary of what you observed

### TOOL CALL STRUCTURE:
\`\`\`json
{
  "dimensions": {
    "S": { "score": 3, "confidence": "LOW|MEDIUM|HIGH", "evidenceCount": 1, "trend": "up|down|stable" },
    "C": { "score": 2.5, "confidence": "LOW", "evidenceCount": 0, "trend": "stable" },
    "O": { "score": 3, "confidence": "LOW", "evidenceCount": 0, "trend": "stable" },
    "P": { "score": 4, "confidence": "MEDIUM", "evidenceCount": 1, "trend": "up" },
    "E": { "score": 2.5, "confidence": "LOW", "evidenceCount": 0, "trend": "stable" }
  },
  "newEvidence": {
    "dimension": "S",
    "type": "positive|negative|contextual",
    "summary": "User demonstrated clear understanding of their current career situation",
    "timestamp": "0:45"
  },
  "phase": "OPENING|CORE|GAP_FILLING|VALIDATION|CLOSING",
  "summary": "Brief summary of session so far",
  "strengths": ["S", "P"],
  "developmentPriorities": ["C", "E"]
}
\`\`\`

**DO NOT speak about the scoring.** Keep conversation natural and story-focused while tracking internally.
`;

// Tool definition matching Culture Coach's working pattern
const updateAssessmentStateTool = {
  type: "function",
  name: "updateAssessmentState",
  description: "Updates the real-time S.C.O.P.E. assessment visualization with dimension scores and evidence.",
  parameters: {
    type: "object",
    properties: {
      dimensions: {
        type: "object",
        properties: {
          S: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          C: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          O: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          P: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
          E: { type: "object", properties: { score: { type: "number" }, confidence: { type: "string" }, evidenceCount: { type: "number" }, trend: { type: "string" } } },
        }
      },
      newEvidence: {
        type: "object",
        description: "New evidence extracted from the user's response",
        properties: {
          dimension: { type: "string", enum: ["S", "C", "O", "P", "E"] },
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
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.OSCONNECTED);
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
        setConnectionState(ConnectionState.OSCONNECTED);
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
                                    category: 'coaching_framework',
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

                                // DEFENSIVE PADDING: Ensure all 5 S.C.O.P.E. dimensions exist
                                const requiredDims = ['S', 'C', 'O', 'P', 'E'];
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
                                console.log(`[DEBUG] Scores: S=${updated.dimensions.S?.score}, C=${updated.dimensions.C?.score}, O=${updated.dimensions.O?.score}, P=${updated.dimensions.P?.score}, E=${updated.dimensions.E?.score}`);

                                // UPDATE SCORE HISTORY (needed for trajectory chart)
                                const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
                                const newPoint = {
                                    time: elapsed,
                                    S: updated.dimensions.S?.score ?? 2.5,
                                    C: updated.dimensions.C?.score ?? 2.5,
                                    O: updated.dimensions.O?.score ?? 2.5,
                                    P: updated.dimensions.P?.score ?? 2.5,
                                    E: updated.dimensions.E?.score ?? 2.5
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
            return ConnectionState.OSCONNECTED;
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
      case ConnectionState.OSCONNECTED: return <span className="text-slate-500">Ready to start</span>;
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
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome to S.C.O.P.E. Coach</h2>
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
                <h3 className="text-lg font-bold text-slate-800 mb-2">Coaching Professional</h3>
                <p className="text-sm text-slate-600">
                  Coaches, consultants, facilitators, or professionals working in personal development and leadership
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
                <h3 className="text-lg font-bold text-slate-800 mb-2">Individual Seeking Growth</h3>
                <p className="text-sm text-slate-600">
                  Anyone interested in personal development, goal-setting, decision-making, and living a more intentional life
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
              Enter your email to receive your comprehensive S.C.O.P.E. Personal Development Report and save your results.
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
                    setConnectionState(ConnectionState.OSCONNECTED);
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
        {connectionState === ConnectionState.OSCONNECTED || connectionState === ConnectionState.ERROR ? (
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
              {(connectionState === ConnectionState.OSCONNECTED || connectionState === ConnectionState.ERROR || connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.COMPLETE) ? (
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
        {connectionState === ConnectionState.OSCONNECTED && !errorMsg && (
          <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100 text-indigo-800 text-sm text-center max-w-md">
            <p className="font-medium mb-1">Ready to explore your S.C.O.P.E.?</p>
            <p className="opacity-80">Start a voice conversation to discover your personal development profile through the S.C.O.P.E. FeedForward Model - assessing your Situation Awareness, Choices, Outcomes vision, Purpose alignment, and Engagement commitment.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export { LiveVoiceCoach };