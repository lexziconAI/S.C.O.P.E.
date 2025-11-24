/**
 * MetaGuardian: Quantum Storytelling Data Model
 * Based on David Boje's framework - antenarratives, quantum superposition, living stories
 * 
 * PARADIGM SHIFT: From static dimension scores to living narrative streams
 */

// =============================================================================
// NARRATIVE STREAM: The Core Living Story Structure
// =============================================================================

export interface NarrativeStream {
  streamId: 'BODY_KNOWLEDGE' | 'BIOMARKER_MYTHOLOGY' | 'DATA_SYNTHESIS' | 'TECHNOLOGY_RELATIONSHIP' | 'FUTURE_HEALTH_IMAGINARY';
  streamName: string; // Human-readable name
  
  // ANTENARRATIVES: Fragmented, in-the-making story bits
  fragments: AntenarativeFragment[];
  
  // QUANTUM SUPERPOSITION: Multiple simultaneous states (they sum to 1.0)
  possibleStates: QuantumState[];
  
  // TEMPORAL ENTANGLEMENT: Past-present-future collapse
  temporalLayers: TemporalLayers;
  
  // GRAND NARRATIVES: Cultural/medical discourses shaping this stream
  grandNarratives: GrandNarrative[];
  
  // LIVING STORY QUALITIES (replace confidence/score)
  coherence: number;      // 0-1: How well fragments connect into threads
  fluidity: number;       // 0-1: How much story is still becoming (high = more potential)
  authenticity: number;   // 0-1: Alignment with user's lived reality
  
  // META
  lastUpdated: string;
  dominantTheme?: string; // Emergent pattern across fragments
}

// =============================================================================
// ANTENARRATIVE FRAGMENT: The Building Block of Story
// =============================================================================

export interface AntenarativeFragment {
  id: string;
  timestamp: string;
  turn: number; // Which conversation turn this emerged from
  
  // THE FRAGMENT ITSELF (incomplete, speculative, contradictory)
  text: string;           // User's actual words (direct quote)
  interpretedMeaning: string; // AI's reading of the fragment
  
  // FRAGMENT TYPE (Boje's categories)
  type: 'memory' | 'speculation' | 'contradiction' | 'desire' | 'fear' | 'bet' | 'turning_point';
  
  // STORY ELEMENTS
  characters: string[];   // Who appears? (self, doctor, family member, "my body")
  tensions: string[];     // Unresolved conflicts within fragment
  possibleEndings: string[]; // Where might this story thread go?
  
  // QUANTUM PROPERTIES
  entangledWith: string[]; // IDs of other fragments this connects to
  superpositionStates: string[]; // Multiple meanings simultaneously present
  
  // CONSTITUTIONAL RESONANCE (Yama principles)
  yamaAlignment: YamaResonance[];
  
  // NARRATIVE QUALITIES
  emotionalTone: 'hopeful' | 'anxious' | 'curious' | 'resistant' | 'empowered' | 'defeated' | 'neutral';
  energyLevel: 'high' | 'medium' | 'low'; // Vitality of this story thread
}

// =============================================================================
// QUANTUM STATE: Simultaneous Truths in Superposition
// =============================================================================

export interface QuantumState {
  state: string;          // e.g., "Empowered Tracker", "Anxious Monitor", "Dutiful Patient"
  probability: number;    // 0-1 (all states sum to 1.0 across stream)
  evidenceThreads: string[]; // Fragment IDs supporting this state
  
  // HOW THIS STATE EMERGED
  firstAppeared: string;  // Timestamp
  evolution: {
    turn: number;
    probability: number;
  }[]; // Track how probability changed over time
  
  // RELATIONSHIP TO OTHER STATES
  conflictsWith?: string[]; // Other states in tension with this one
  reinforces?: string[];    // Other states that strengthen this one
}

// =============================================================================
// TEMPORAL ENTANGLEMENT: Past-Present-Future Collapse
// =============================================================================

export interface TemporalLayers {
  // PAST: Historical health narratives
  pastStories: {
    story: string;
    fragmentIds: string[]; // Which fragments reference this past
    emotionalValence: 'positive' | 'negative' | 'neutral';
  }[];
  
  // PRESENT: Current lived experiences
  presentMoments: {
    moment: string;
    fragmentIds: string[];
    intensity: 'vivid' | 'moderate' | 'background';
  }[];
  
  // FUTURE: Imagined health trajectories
  futureProjections: {
    projection: string;
    fragmentIds: string[];
    desirability: 'desired' | 'feared' | 'resigned' | 'hopeful';
    plausibility: 'likely' | 'possible' | 'wishful';
  }[];
}

// =============================================================================
// GRAND NARRATIVE: Cultural/Medical Discourses
// =============================================================================

export interface GrandNarrative {
  discourse: string;      // e.g., "Medical authority", "Quantified self", "Genetic determinism"
  category: 'medical_establishment' | 'wellness_industry' | 'family_legacy' | 'cultural_mythos' | 'tech_solutionism';
  
  // HOW USER RELATES TO THIS GRAND NARRATIVE
  influence: 'dominant' | 'contested' | 'emerging' | 'fading';
  userStance: 'accepting' | 'resisting' | 'negotiating' | 'transforming';
  
  // EVIDENCE
  manifestsIn: string[];  // Fragment IDs where this discourse appears
  
  // POWER DYNAMICS
  empowering: boolean;    // Does this narrative give user agency?
  constraining: boolean;  // Does it limit possible stories?
}

// =============================================================================
// YAMA RESONANCE: Constitutional AI as Storytelling Ethics
// =============================================================================

export interface YamaResonance {
  principle: 'Ahimsa' | 'Satya' | 'Asteya' | 'Brahmacharya' | 'Aparigraha';
  resonance: 'harmony' | 'tension' | 'exploration';
  insight: string;        // What this principle reveals about the fragment
  
  // EXAMPLES:
  // Ahimsa (non-harm): Fragment "I push myself too hard" → TENSION
  // Satya (truth): Fragment "I pretend I'm fine" → TENSION  
  // Asteya (non-stealing): Fragment "I do it for my family" → EXPLORATION (whose story is this?)
  // Brahmacharya (right energy): Fragment "I track everything obsessively" → TENSION
  // Aparigraha (non-attachment): Fragment "I can't let go of control" → TENSION
}

// =============================================================================
// SESSION STATE: Complete Quantum Story System
// =============================================================================

export interface QuantumStorySession {
  sessionId: string;
  userId: string;
  startTime: string;
  
  // THE FIVE NARRATIVE STREAMS (was: dimensions)
  narrativeStreams: {
    BODY_KNOWLEDGE: NarrativeStream;
    BIOMARKER_MYTHOLOGY: NarrativeStream;
    DATA_SYNTHESIS: NarrativeStream;
    TECHNOLOGY_RELATIONSHIP: NarrativeStream;
    FUTURE_HEALTH_IMAGINARY: NarrativeStream;
  };
  
  // ALL FRAGMENTS (cross-stream view)
  allFragments: AntenarativeFragment[];
  
  // STORY PHASE (was: conversation phase)
  phase: 'INVOCATION' | 'EMERGENCE' | 'ENTANGLEMENT' | 'CRYSTALLIZATION' | 'OPENING';
  // INVOCATION: Calling the story forth (was: OPENING)
  // EMERGENCE: Story fragments appearing (was: CORE)
  // ENTANGLEMENT: Fragments connecting, contradicting (was: GAP_FILLING)
  // CRYSTALLIZATION: Patterns becoming clear (was: VALIDATION)
  // OPENING: New possibilities emerging (was: CLOSING)
  
  // NARRATIVE QUALITIES (whole-session level)
  overallCoherence: number;     // Do streams connect?
  narrativeComplexity: number;  // How many entangled threads?
  storyVitality: number;        // How alive/generative is this story?
  
  // CONSTITUTIONAL HEALTH
  yamaBalance: {
    principle: YamaResonance['principle'];
    harmonyCount: number;
    tensionCount: number;
    explorationCount: number;
  }[];
  
  // META
  turnCount: number;
  isComplete: boolean;
  
  // STORY SYNTHESIS (generated at end)
  synthesis?: {
    livingStorySummary: string;
    simultaneousTruths: string[]; // Quantum superposition honored
    possibleFutures: StoryPath[];
    grandNarrativeAnalysis: string;
  };
}

// =============================================================================
// STORY PATH: Possible Future Narratives (replaces recommendations)
// =============================================================================

export interface StoryPath {
  pathName: string;       // e.g., "The Data Detective", "The Minimalist Tracker"
  description: string;    // What this story entails
  
  // WHICH STREAMS THIS PATH STRENGTHENS
  strengthensStreams: {
    streamId: NarrativeStream['streamId'];
    how: string;
  }[];
  
  // ANTENARRATIVE SEEDS (what user already said that points here)
  seeds: string[];        // Fragment quotes that support this path
  
  // STORY QUALITIES
  alignment: number;      // 0-1: How well does this fit user's current story?
  novelty: number;        // 0-1: How different from current trajectory?
  vitality: number;       // 0-1: How generative/life-giving is this path?
  
  // NEXT CHAPTER PREVIEW
  nextChapter: string;    // "If you take this path, the next 3 months might look like..."
}

// =============================================================================
// INITIAL STATE CONSTRUCTOR
// =============================================================================

export const createEmptyNarrativeStream = (
  streamId: NarrativeStream['streamId'], 
  streamName: string
): NarrativeStream => ({
  streamId,
  streamName,
  fragments: [],
  possibleStates: [],
  temporalLayers: {
    pastStories: [],
    presentMoments: [],
    futureProjections: []
  },
  grandNarratives: [],
  coherence: 0,
  fluidity: 1.0, // Start maximally fluid (becoming)
  authenticity: 0,
  lastUpdated: new Date().toISOString()
});

export const INITIAL_QUANTUM_SESSION: QuantumStorySession = {
  sessionId: '',
  userId: '',
  startTime: new Date().toISOString(),
  narrativeStreams: {
    BODY_KNOWLEDGE: createEmptyNarrativeStream('BODY_KNOWLEDGE', 'Body Knowledge Stream'),
    BIOMARKER_MYTHOLOGY: createEmptyNarrativeStream('BIOMARKER_MYTHOLOGY', 'Biomarker Mythology Stream'),
    DATA_SYNTHESIS: createEmptyNarrativeStream('DATA_SYNTHESIS', 'Data Synthesis Narrative'),
    TECHNOLOGY_RELATIONSHIP: createEmptyNarrativeStream('TECHNOLOGY_RELATIONSHIP', 'Technology Relationship Story'),
    FUTURE_HEALTH_IMAGINARY: createEmptyNarrativeStream('FUTURE_HEALTH_IMAGINARY', 'Future Health Imaginary')
  },
  allFragments: [],
  phase: 'INVOCATION',
  overallCoherence: 0,
  narrativeComplexity: 0,
  storyVitality: 1.0,
  yamaBalance: [
    { principle: 'Ahimsa', harmonyCount: 0, tensionCount: 0, explorationCount: 0 },
    { principle: 'Satya', harmonyCount: 0, tensionCount: 0, explorationCount: 0 },
    { principle: 'Asteya', harmonyCount: 0, tensionCount: 0, explorationCount: 0 },
    { principle: 'Brahmacharya', harmonyCount: 0, tensionCount: 0, explorationCount: 0 },
    { principle: 'Aparigraha', harmonyCount: 0, tensionCount: 0, explorationCount: 0 }
  ],
  turnCount: 0,
  isComplete: false
};

// =============================================================================
// TYPE GUARDS & UTILITIES
// =============================================================================

export const isContradictionFragment = (frag: AntenarativeFragment): boolean => 
  frag.type === 'contradiction' || frag.tensions.length > 1;

export const calculateStreamCoherence = (stream: NarrativeStream): number => {
  if (stream.fragments.length < 2) return 0;
  
  // Count entanglements (connections between fragments)
  const totalPossibleConnections = (stream.fragments.length * (stream.fragments.length - 1)) / 2;
  const actualConnections = stream.fragments.reduce((sum, frag) => 
    sum + frag.entangledWith.length, 0) / 2; // Divide by 2 (bidirectional)
  
  return actualConnections / totalPossibleConnections;
};

export const calculateStreamFluidity = (stream: NarrativeStream): number => {
  // High fluidity = many speculations, contradictions, unresolved tensions
  const becomingTypes = ['speculation', 'contradiction', 'bet'];
  const becomingFrags = stream.fragments.filter(f => becomingTypes.includes(f.type));
  const unresolvedTensions = stream.fragments.reduce((sum, f) => sum + f.tensions.length, 0);
  
  return Math.min(1.0, (becomingFrags.length + unresolvedTensions * 0.1) / stream.fragments.length);
};

export const calculateStreamAuthenticity = (stream: NarrativeStream): number => {
  // High authenticity = emotionally vivid, high-energy fragments
  const vividFragments = stream.fragments.filter(f => 
    f.emotionalTone !== 'neutral' && f.energyLevel !== 'low'
  );
  
  return stream.fragments.length > 0 ? vividFragments.length / stream.fragments.length : 0;
};

// =============================================================================
// STREAM ID MAPPING (for legacy compatibility)
// =============================================================================

export const STREAM_ID_MAP = {
  HL: 'BODY_KNOWLEDGE',
  CM: 'BIOMARKER_MYTHOLOGY',
  DI: 'DATA_SYNTHESIS',
  DL: 'TECHNOLOGY_RELATIONSHIP',
  PR: 'FUTURE_HEALTH_IMAGINARY'
} as const;

export const STREAM_NAMES = {
  BODY_KNOWLEDGE: 'Body Knowledge Stream',
  BIOMARKER_MYTHOLOGY: 'Biomarker Mythology Stream',
  DATA_SYNTHESIS: 'Data Synthesis Narrative',
  TECHNOLOGY_RELATIONSHIP: 'Technology Relationship Story',
  FUTURE_HEALTH_IMAGINARY: 'Future Health Imaginary'
} as const;
