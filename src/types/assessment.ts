/**
 * MetaGuardian Assessment Types
 * Replaces Culture Coach dimensions with metabolic health assessment structure
 */

// PLACEHOLDER: Metabolic Health Assessment Dimensions
export interface MetabolicDimension {
  score: number;           // 0-5 scale maintained from Culture Coach
  confidence: 'low' | 'medium' | 'high';
  evidenceCount: number;
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
}

export interface MetabolicAssessment {
  // TODO: Define metabolic health assessment dimensions
  // Examples (to be validated with research):
  dimensions: {
    HL?: MetabolicDimension;  // Health Literacy
    DL?: MetabolicDimension;  // Digital Literacy  
    CM?: MetabolicDimension;  // Clinical Marker Awareness
    PR?: MetabolicDimension;  // Prevention Readiness
    DI?: MetabolicDimension;  // Data Integration Comfort
  };
  
  // Infrastructure preserved from Culture Coach
  confidence: number;
  timestamp: string;
  phase: 'OPENING' | 'CORE' | 'GAP_FILLING' | 'VALIDATION' | 'CLOSING';
  isComplete: boolean;
  
  // Evidence logging (proven pattern from Culture Coach)
  evidenceLog: Evidence[];
  contradictions?: Contradiction[];
  
  // Recommendations and insights
  strengths: string[];
  developmentPriorities: string[];
  summary?: string;
  
  // MetaGuardian-specific (to be implemented)
  participantType?: 'general_public' | 'healthcare_expert';
  roughData?: LifestyleDataSnapshot;
  preciseData?: ClinicalDataSnapshot;
  
  // Constitutional AI provenance
  provenance?: CryptographicReceipt;
}

export interface Evidence {
  dimension: string;
  type: 'positive' | 'negative' | 'contextual';
  summary: string;
  timestamp: string;
  turn?: number;
}

export interface Contradiction {
  dimension: string;
  earlyStatement: string;
  lateStatement: string;
  resolution: string;
}

// PLACEHOLDER: Lifestyle data structure
export interface LifestyleDataSnapshot {
  // Self-reported, qualitative
  sleepQuality?: string;
  dietaryHabits?: string;
  physicalActivity?: string;
  stressLevels?: string;
  // To be expanded based on research needs
}

// PLACEHOLDER: Clinical data structure  
export interface ClinicalDataSnapshot {
  // Lab results, biomarkers
  glucoseLevels?: number[];
  hba1c?: number;
  lipidPanel?: {
    totalCholesterol?: number;
    ldl?: number;
    hdl?: number;
    triglycerides?: number;
  };
  // To be expanded based on research protocols
}

export interface CryptographicReceipt {
  signature: string;        // Ed25519 signature
  publicKey: string;
  timestamp: string;
  dataHash: string;
  constitutionalPrinciples: string[];
}

// Connection states (preserved from Culture Coach)
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING', 
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  COMPLETE = 'COMPLETE'
}

// Session state (adapted for MetaGuardian)
export interface SessionState extends MetabolicAssessment {
  turnCount: number;
}

// NOTE: Use INITIAL_SESSION_STATE from /types.ts instead
// This file's SessionState is deprecated - use the root types.ts
