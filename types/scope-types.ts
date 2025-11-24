/**
 * S.C.O.P.E. Coach Dual-Mode Type System
 *
 * Comprehensive TypeScript types for the sequential and natural conversation modes.
 * These types support the full lifecycle of coaching conversations, component extraction,
 * validation, and script generation.
 */

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Operating modes for the S.C.O.P.E. Coach system
 * - sequential: Guided step-by-step through each component
 * - natural: Free-form conversation with real-time extraction
 */
export type CoachMode = 'sequential' | 'natural';

/**
 * The five components of the S.C.O.P.E. framework
 */
export type ComponentType = 'situation' | 'choices' | 'outcomes' | 'purpose' | 'engagement';

/**
 * Status tracking for task completion
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

/**
 * Confidence levels for extraction and validation
 */
export type ConfidenceLevel = 'low' | 'medium' | 'high';

/**
 * Quality score ranges for component assessment
 */
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

// =============================================================================
// CONTEXT TYPES
// =============================================================================

/**
 * Trust level between manager and team member
 */
export type TrustLevel = 'building' | 'established' | 'strong';

/**
 * Relationship type to the manager
 */
export type RelationshipType = 'direct_report' | 'peer' | 'skip_level' | 'cross_functional';

/**
 * Information about the person being coached
 */
export interface PersonContext {
  /** Role/title of the person */
  role: string;
  /** Name of the person */
  name: string;
  /** Relationship to the manager conducting the conversation */
  relationshipToManager: RelationshipType;
  /** Current trust level in the relationship */
  trustLevel: TrustLevel;
  /** Optional tenure information */
  tenure?: string;
  /** Optional previous conversation context */
  previousConversations?: string[];
}

/**
 * Full context for the coaching conversation
 */
export interface CoachingContext {
  /** Who is involved in this situation */
  who: PersonContext;
  /** What behavior or situation needs addressing */
  what: string;
  /** When did/will this occur (timing context) */
  when: string;
  /** Why is this conversation happening (underlying reason) */
  why: string;
  /** Relationship dynamics to consider */
  relationship: string;
  /** Optional: specific goals for the conversation */
  conversationGoals?: string[];
  /** Optional: constraints or sensitivities to consider */
  constraints?: string[];
}

// =============================================================================
// COMPONENT TYPES - Quality Criteria
// =============================================================================

/**
 * Quality criteria for Situation component
 */
export interface SituationQuality {
  /** Is the situation framed toward the future, not dwelling on past mistakes? */
  futureOriented: QualityScore;
  /** Does it include specific, concrete details? */
  specific: QualityScore;
  /** Can the behavior/situation be observed by others? */
  observable: QualityScore;
  /** Is it relevant to the person's role and growth? */
  relevant: QualityScore;
}

/**
 * Quality criteria for Choices component
 */
export interface ChoicesQuality {
  /** Are the choices framed as behaviors/actions (not attitudes)? */
  behavioral: QualityScore;
  /** Are they specific enough to act on? */
  specific: QualityScore;
  /** Are they within the person's control? */
  withinControl: QualityScore;
  /** Are they genuinely different approaches (not obviously right/wrong)? */
  genuinelyDifferent: QualityScore;
}

/**
 * Quality criteria for Outcomes component
 */
export interface OutcomesQuality {
  /** Do outcomes focus on immediate/near-term results? */
  immediate: QualityScore;
  /** Are outcomes observable/measurable? */
  observable: QualityScore;
  /** Are outcomes clearly linked to the corresponding choice? */
  behaviorLinked: QualityScore;
  /** Are outcomes framed positively (even challenging ones)? */
  positiveFraming: QualityScore;
}

/**
 * Quality criteria for Purpose component
 */
export interface PurposeQuality {
  /** Does it connect to something meaningful to the person? */
  meaningful: QualityScore;
  /** Is it motivating and energizing? */
  motivating: QualityScore;
  /** Does it support growth and development? */
  growthOriented: QualityScore;
}

/**
 * Quality criteria for Engagement component
 */
export interface EngagementQuality {
  /** Is the question open-ended (not yes/no)? */
  openEnded: QualityScore;
  /** Does it create psychological safety? */
  safetyBuilding: QualityScore;
  /** Does it invite the person to take ownership? */
  ownershipInviting: QualityScore;
}

// =============================================================================
// COMPONENT TYPES - Full Components
// =============================================================================

/**
 * Situation component with content and quality assessment
 */
export interface SituationComponent {
  /** The situation statement content */
  content: string;
  /** Quality scores for the situation */
  quality: SituationQuality;
  /** Overall effectiveness score (computed) */
  overallScore?: number;
}

/**
 * Choices component with two options and quality assessment
 */
export interface ChoicesComponent {
  /** First choice option */
  choice1: string;
  /** Second choice option */
  choice2: string;
  /** Quality scores for the choices */
  quality: ChoicesQuality;
  /** Overall effectiveness score (computed) */
  overallScore?: number;
}

/**
 * Outcomes component with consequences for each choice
 */
export interface OutcomesComponent {
  /** Outcome for choice 1 */
  outcomeChoice1: string;
  /** Outcome for choice 2 */
  outcomeChoice2: string;
  /** Quality scores for the outcomes */
  quality: OutcomesQuality;
  /** Overall effectiveness score (computed) */
  overallScore?: number;
}

/**
 * Purpose component connecting to meaning and motivation
 */
export interface PurposeComponent {
  /** The purpose statement content */
  content: string;
  /** Quality scores for the purpose */
  quality: PurposeQuality;
  /** Overall effectiveness score (computed) */
  overallScore?: number;
}

/**
 * Engagement component for closing the conversation
 */
export interface EngagementComponent {
  /** The engagement question/statement content */
  content: string;
  /** Quality scores for the engagement */
  quality: EngagementQuality;
  /** Overall effectiveness score (computed) */
  overallScore?: number;
}

/**
 * Union type for any component
 */
export type ScopeComponent =
  | SituationComponent
  | ChoicesComponent
  | OutcomesComponent
  | PurposeComponent
  | EngagementComponent;

/**
 * Map of all components by type
 */
export interface ComponentMap {
  situation?: SituationComponent;
  choices?: ChoicesComponent;
  outcomes?: OutcomesComponent;
  purpose?: PurposeComponent;
  engagement?: EngagementComponent;
}

// =============================================================================
// EXTRACTION TYPES
// =============================================================================

/**
 * Generic extraction result for a single component
 */
export interface ComponentExtraction<T> {
  /** Whether the component was successfully extracted */
  extracted: boolean;
  /** Confidence in the extraction */
  confidence: ConfidenceLevel;
  /** The extracted content */
  content: T | null;
  /** Evidence from the conversation supporting this extraction */
  evidence: string[];
  /** Quality assessment of the extracted content */
  quality: T extends SituationComponent ? SituationQuality :
           T extends ChoicesComponent ? ChoicesQuality :
           T extends OutcomesComponent ? OutcomesQuality :
           T extends PurposeComponent ? PurposeQuality :
           T extends EngagementComponent ? EngagementQuality :
           never;
}

/**
 * Contradiction found between statements in the conversation
 */
export interface Contradiction {
  /** Type of component with contradiction */
  componentType: ComponentType;
  /** Earlier statement that conflicts */
  earlierStatement: string;
  /** Later statement that conflicts */
  laterStatement: string;
  /** Timestamp of earlier statement */
  earlierTimestamp?: string;
  /** Timestamp of later statement */
  laterTimestamp?: string;
  /** Severity of the contradiction */
  severity: 'minor' | 'moderate' | 'major';
}

/**
 * Suggested probe question for gathering more information
 */
export interface ProbeQuestion {
  /** The question to ask */
  question: string;
  /** Target component this will help clarify */
  targetComponent: ComponentType;
  /** Priority of asking this question */
  priority: 'low' | 'medium' | 'high';
  /** Why this probe is needed */
  rationale: string;
}

/**
 * Complete extraction result from a conversation
 */
export interface ExtractionResult {
  /** Extracted components */
  components: {
    situation: ComponentExtraction<SituationComponent>;
    choices: ComponentExtraction<ChoicesComponent>;
    outcomes: ComponentExtraction<OutcomesComponent>;
    purpose: ComponentExtraction<PurposeComponent>;
    engagement: ComponentExtraction<EngagementComponent>;
  };
  /** Overall completeness percentage (0-100) */
  completeness: number;
  /** Any contradictions found */
  contradictions: Contradiction[];
  /** Components that still need information */
  missingComponents: ComponentType[];
  /** Suggested next probe question */
  nextProbe: ProbeQuestion | null;
  /** Timestamp of extraction */
  extractedAt: string;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Feedback tiers for validation
 */
export interface ValidationFeedback {
  /** Feedback for excellent quality (4-5) */
  strong: string;
  /** Feedback for acceptable quality (2-3) */
  medium: string;
  /** Feedback for needs improvement (0-1) */
  weak: string;
}

/**
 * Single validation check result
 */
export interface ValidationCheck {
  /** Whether this check passed */
  pass: boolean;
  /** Score for this criterion */
  score: QualityScore;
  /** Tiered feedback based on score */
  feedback: ValidationFeedback;
  /** Specific suggestions for improvement */
  suggestions?: string[];
}

/**
 * Validation results for a component
 */
export type ComponentValidation<T extends Record<string, QualityScore>> = {
  [K in keyof T]: ValidationCheck;
};

/**
 * Complete validation result
 */
export interface ValidationResult {
  /** Individual validation checks */
  checks: ComponentValidation<Record<string, QualityScore>>;
  /** Overall score (0-100) */
  overallScore: number;
  /** Whether the component meets minimum quality threshold */
  meetsThreshold: boolean;
  /** Summary of validation */
  summary: string;
}

/**
 * Full validation results for all components
 */
export interface FullValidationResult {
  situation: ValidationResult;
  choices: ValidationResult;
  outcomes: ValidationResult;
  purpose: ValidationResult;
  engagement: ValidationResult;
  /** Overall script quality score */
  overallScriptScore: number;
  /** Whether the full script is ready for use */
  scriptReady: boolean;
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * Role in a conversation
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Single message in a conversation
 */
export interface Message {
  /** Role of the message sender */
  role: MessageRole;
  /** Content of the message */
  content: string;
  /** Timestamp of the message */
  timestamp: string;
  /** Optional message ID */
  id?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Current state of a conversation
 */
export interface ConversationState {
  /** Full conversation transcript */
  transcript: Message[];
  /** Currently extracted components */
  components: Partial<ComponentMap>;
  /** Completeness percentage */
  completeness: number;
  /** Detected contradictions */
  contradictions: Contradiction[];
  /** Components still needing information */
  missingComponents: ComponentType[];
  /** Next suggested probe */
  nextProbe: ProbeQuestion | null;
  /** Current phase of conversation */
  phase: 'gathering' | 'refining' | 'validating' | 'complete';
  /** Session start time */
  startedAt: string;
  /** Last update time */
  updatedAt: string;
}

// =============================================================================
// SCRIPT TYPES
// =============================================================================

/**
 * Generated S.C.O.P.E. script for use in conversation
 */
export interface ScopeScript {
  /** Formal, structured script */
  formalScript: string;
  /** Conversational, natural-sounding script */
  conversationalScript: string;
  /** The component data used to generate the script */
  components: ComponentMap;
  /** When the script was generated */
  generatedAt: string;
  /** Constitutional validation receipt */
  receipt: ConstitutionalReceipt;
  /** Version of the script */
  version: number;
  /** Optional notes for the manager */
  coachingNotes?: string[];
}

/**
 * Script generation options
 */
export interface ScriptGenerationOptions {
  /** Tone preference */
  tone: 'formal' | 'casual' | 'balanced';
  /** Include coaching notes */
  includeNotes: boolean;
  /** Target conversation length */
  lengthPreference: 'brief' | 'standard' | 'detailed';
}

// =============================================================================
// CONSTITUTIONAL TYPES
// =============================================================================

/**
 * The five Yamas (ethical principles) applied to coaching
 */
export type YamaType =
  | 'ahimsa'      // Non-harm
  | 'satya'       // Truthfulness
  | 'asteya'      // Non-stealing (respect autonomy)
  | 'brahmacharya'// Right use of energy
  | 'aparigraha'; // Non-attachment

/**
 * A violation of a Yama principle
 */
export interface YamaViolation {
  /** Which Yama was violated */
  yama: YamaType;
  /** Description of the violation */
  violation: string;
  /** Suggested correction */
  suggestion: string;
  /** Severity of violation */
  severity: 'warning' | 'error' | 'critical';
  /** Location in the script */
  location?: {
    component: ComponentType;
    text: string;
  };
}

/**
 * Constitutional validation receipt
 */
export interface ConstitutionalReceipt {
  /** Hash of the validated content */
  hash: string;
  /** Timestamp of validation */
  timestamp: string;
  /** Components that were validated */
  components: ComponentType[];
  /** Validation results per component */
  validations: {
    [K in ComponentType]?: {
      passed: boolean;
      score: number;
      violations: YamaViolation[];
    };
  };
  /** Overall constitutional compliance */
  compliant: boolean;
  /** Receipt ID for tracking */
  receiptId: string;
}

// =============================================================================
// PROPS TYPES
// =============================================================================

/**
 * Props for the mode selector component
 */
export interface ModeSelectorProps {
  /** Callback when a mode is selected */
  onModeSelect: (mode: CoachMode) => void;
  /** Currently selected mode (for controlled component) */
  selectedMode?: CoachMode;
  /** Whether selection is disabled */
  disabled?: boolean;
}

/**
 * Props for the sequential mode coach
 */
export interface ScopeCoachSequentialProps {
  /** Callback when script is complete */
  onComplete: (script: ScopeScript) => void;
  /** Initial context for the conversation */
  initialContext?: Partial<CoachingContext>;
  /** Optional callback for step changes */
  onStepChange?: (step: ComponentType) => void;
  /** Optional callback for progress updates */
  onProgress?: (completeness: number) => void;
}

/**
 * Props for the natural conversation mode coach
 */
export interface ScopeCoachNaturalProps {
  /** Callback when script is complete */
  onComplete: (script: ScopeScript) => void;
  /** Initial context for the conversation */
  initialContext?: Partial<CoachingContext>;
  /** Optional callback for extraction updates */
  onExtractionUpdate?: (result: ExtractionResult) => void;
  /** Optional callback for conversation state changes */
  onStateChange?: (state: ConversationState) => void;
}

/**
 * Props for component display/editor
 */
export interface ComponentEditorProps<T extends ScopeComponent> {
  /** The component being edited */
  component: T;
  /** Callback when component is updated */
  onChange: (updated: T) => void;
  /** Validation result for the component */
  validation?: ValidationResult;
  /** Whether editing is disabled */
  disabled?: boolean;
}

/**
 * Props for the script preview component
 */
export interface ScriptPreviewProps {
  /** The script to preview */
  script: ScopeScript;
  /** Which version to display */
  displayMode: 'formal' | 'conversational' | 'side-by-side';
  /** Callback for copy action */
  onCopy?: () => void;
  /** Callback for export action */
  onExport?: (format: 'pdf' | 'docx' | 'txt') => void;
}

/**
 * Props for the validation display component
 */
export interface ValidationDisplayProps {
  /** Validation results to display */
  validation: FullValidationResult;
  /** Whether to show detailed feedback */
  showDetails: boolean;
  /** Callback when user wants to revise */
  onRevise?: (component: ComponentType) => void;
}

// =============================================================================
// SESSION & STORAGE TYPES
// =============================================================================

/**
 * Saved session for resuming later
 */
export interface SavedSession {
  /** Unique session ID */
  id: string;
  /** Session name/title */
  name: string;
  /** The coaching context */
  context: CoachingContext;
  /** Current conversation state */
  state: ConversationState;
  /** Mode being used */
  mode: CoachMode;
  /** Created timestamp */
  createdAt: string;
  /** Last modified timestamp */
  updatedAt: string;
  /** Whether session is complete */
  completed: boolean;
  /** Generated script if complete */
  script?: ScopeScript;
}

/**
 * User preferences for the app
 */
export interface UserPreferences {
  /** Preferred coach mode */
  preferredMode: CoachMode;
  /** Default tone for scripts */
  defaultTone: 'formal' | 'casual' | 'balanced';
  /** Auto-save enabled */
  autoSave: boolean;
  /** Auto-save interval in seconds */
  autoSaveInterval: number;
  /** Show validation hints during editing */
  showHints: boolean;
}

// =============================================================================
// API TYPES
// =============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  /** Whether request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Error code if failed */
  errorCode?: string;
}

/**
 * Request to extract components from conversation
 */
export interface ExtractRequest {
  /** Conversation messages */
  messages: Message[];
  /** Current context */
  context: CoachingContext;
  /** Previously extracted components */
  existingComponents?: Partial<ComponentMap>;
}

/**
 * Request to validate a script
 */
export interface ValidateRequest {
  /** Components to validate */
  components: ComponentMap;
  /** Context for validation */
  context: CoachingContext;
}

/**
 * Request to generate a script
 */
export interface GenerateScriptRequest {
  /** Validated components */
  components: ComponentMap;
  /** Generation options */
  options: ScriptGenerationOptions;
  /** Context */
  context: CoachingContext;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Deep partial type for nested optional properties
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Required fields for a type
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Component type to quality type mapping
 */
export type ComponentQualityMap = {
  situation: SituationQuality;
  choices: ChoicesQuality;
  outcomes: OutcomesQuality;
  purpose: PurposeQuality;
  engagement: EngagementQuality;
};

/**
 * Component type to component interface mapping
 */
export type ComponentTypeMap = {
  situation: SituationComponent;
  choices: ChoicesComponent;
  outcomes: OutcomesComponent;
  purpose: PurposeComponent;
  engagement: EngagementComponent;
};

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All component types in order
 */
export const COMPONENT_ORDER: ComponentType[] = [
  'situation',
  'choices',
  'outcomes',
  'purpose',
  'engagement'
];

/**
 * Display names for components
 */
export const COMPONENT_DISPLAY_NAMES: Record<ComponentType, string> = {
  situation: 'Situation',
  choices: 'Choices',
  outcomes: 'Outcomes',
  purpose: 'Purpose',
  engagement: 'Engagement'
};

/**
 * Yama display names and descriptions
 */
export const YAMA_INFO: Record<YamaType, { name: string; description: string }> = {
  ahimsa: {
    name: 'Non-Harm (Ahimsa)',
    description: 'Communication should not cause psychological harm or damage self-worth'
  },
  satya: {
    name: 'Truthfulness (Satya)',
    description: 'Content should be honest and not manipulative'
  },
  asteya: {
    name: 'Non-Stealing (Asteya)',
    description: 'Respect autonomy; do not steal choice or agency'
  },
  brahmacharya: {
    name: 'Right Energy (Brahmacharya)',
    description: 'Use appropriate energy; not too aggressive or passive'
  },
  aparigraha: {
    name: 'Non-Attachment (Aparigraha)',
    description: 'Allow person to reach their own conclusions'
  }
};

/**
 * Quality score thresholds
 */
export const QUALITY_THRESHOLDS = {
  minimum: 2,
  acceptable: 3,
  good: 4,
  excellent: 5
} as const;

/**
 * Completeness thresholds
 */
export const COMPLETENESS_THRESHOLDS = {
  insufficient: 25,
  partial: 50,
  substantial: 75,
  complete: 100
} as const;
