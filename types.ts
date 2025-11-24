export interface VisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  color?: string;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  COMPLETE = 'COMPLETE',
}

// NEW: Explicit source attribution for all scoring updates
export enum InferenceSource {
  OPENAI_REALTIME = 'openai_realtime',
  SIDECAR_GROQ = 'sidecar_groq',
  SIDECAR_KIMI = 'sidecar_kimi',
  FALLBACK_RULE = 'fallback_rule'  // For emergency hardcoded rules
}

export interface InferenceMetadata {
  source: InferenceSource;
  model: string;  // e.g., "gpt-4o-realtime-preview-2024-12-17"
  timestamp: string;
  confidence: number;  // 0-1 scale
  reasoning_trace?: string;  // Optional: why this inference was made
  call_id: string;  // Original call_id from tool call
}

export interface DimensionState {
  score: number;           // Current estimate (0-5)
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceCount: number;
  trend: 'up' | 'down' | 'stable';
  contextNotes?: string;

  // NEW: Add inference tracking
  lastInference?: InferenceMetadata;  // Track most recent update source
  inferenceHistory?: InferenceMetadata[];  // Full history of updates
}

export interface EvidenceItem {
  timestamp: string;
  dimension: string;
  type: 'positive' | 'negative' | 'contextual';
  summary: string;
  scoreImpact?: number;

  // NEW: Add source attribution
  inferenceMetadata?: InferenceMetadata;
}

export interface ContradictionAlert {
  dimension: string;
  earlyStatement: string;
  lateStatement: string;
  resolution: string;
}

export interface ScorePoint {
  time: number; // seconds from start
  S: number;
  C: number;
  O: number;
  P: number;
  E: number;
}

export interface SessionState {
  dimensions: {
    S: DimensionState; // Situation Awareness
    C: DimensionState; // Choices Recognition
    O: DimensionState; // Outcomes Visualization
    P: DimensionState; // Purpose Alignment
    E: DimensionState; // Engagement Commitment
  };
  scoreHistory: ScorePoint[];
  evidenceLog: EvidenceItem[];
  contradictions: ContradictionAlert[];
  conversationPhase: 'OPENING' | 'CORE' | 'GAP_FILLING' | 'VALIDATION' | 'CLOSING';
  strengths: string[];
  developmentPriorities: string[];
  summary?: string;
  fullReport?: string;
}

export const INITIAL_SESSION_STATE: SessionState = {
  dimensions: {
    S: { score: 2.5, confidence: 'LOW', evidenceCount: 0, trend: 'stable' },
    C: { score: 2.5, confidence: 'LOW', evidenceCount: 0, trend: 'stable' },
    O: { score: 2.5, confidence: 'LOW', evidenceCount: 0, trend: 'stable' },
    P: { score: 2.5, confidence: 'LOW', evidenceCount: 0, trend: 'stable' },
    E: { score: 2.5, confidence: 'LOW', evidenceCount: 0, trend: 'stable' },
  },
  scoreHistory: [{ time: 0, S: 2.5, C: 2.5, O: 2.5, P: 2.5, E: 2.5 }],
  evidenceLog: [],
  contradictions: [],
  conversationPhase: 'OPENING',
  strengths: [],
  developmentPriorities: [],
};

export const DIMENSION_LABELS: Record<string, string> = {
  S: "Situation Awareness",
  C: "Choices Recognition",
  O: "Outcomes Visualization",
  P: "Purpose Alignment",
  E: "Engagement Commitment"
};
