/**
 * MetaGuardian Interview Questions
 * PLACEHOLDERS - To be finalized with research team
 */

export interface InterviewQuestion {
  id: string;
  text: string;
  category: string;
  followUps?: string[];
  assessmentFocus?: string[];
}

// PLACEHOLDER: 10 Questions for General Public
export const GENERAL_PUBLIC_QUESTIONS: InterviewQuestion[] = [
  {
    id: "gp-1",
    text: "Can you describe how you currently keep track of your health and well-being?",
    category: "health-tracking",
    assessmentFocus: ["HL", "DL"],
  },
  {
    id: "gp-2", 
    text: "Are you familiar with digital tools like apps, devices, or wearables that help track your health?",
    category: "digital-literacy",
    assessmentFocus: ["DL"],
  },
  {
    id: "gp-3",
    text: "Have you ever had blood tests or health screenings done? What do you remember about the results?",
    category: "clinical-awareness",
    assessmentFocus: ["CM", "HL"],
  },
  {
    id: "gp-4",
    text: "When you think about preventing health issues like diabetes or heart disease, what comes to mind?",
    category: "prevention-mindset",
    assessmentFocus: ["PR", "HL"],
  },
  {
    id: "gp-5",
    text: "If you could have a tool that combines your daily habits with your health test results, how would you want it to work?",
    category: "data-integration",
    assessmentFocus: ["DI", "DL"],
  },
  {
    id: "gp-6",
    text: "What would make you trust health information or recommendations from a digital tool?",
    category: "trust-factors",
    assessmentFocus: ["PR", "DL"],
  },
  {
    id: "gp-7",
    text: "How comfortable are you with sharing your health data if it could help with early disease detection?",
    category: "data-privacy",
    assessmentFocus: ["DI", "PR"],
  },
  {
    id: "gp-8",
    text: "Describe a time when you made a change to improve your health. What motivated you?",
    category: "behavior-change",
    assessmentFocus: ["PR", "HL"],
  },
  {
    id: "gp-9",
    text: "If you received a health alert saying you might be at risk for a condition, what would you do?",
    category: "risk-response",
    assessmentFocus: ["PR", "CM"],
  },
  {
    id: "gp-10",
    text: "What questions do you wish you could ask about your own health data?",
    category: "curiosity-gaps",
    assessmentFocus: ["HL", "CM", "DI"],
  },
];

// PLACEHOLDER: 11 Questions for Healthcare Experts
export const EXPERT_QUESTIONS: InterviewQuestion[] = [
  {
    id: "exp-1",
    text: "What types of data do you find most useful for early detection and management of chronic diseases such as diabetes?",
    category: "clinical-perspective",
    assessmentFocus: ["CM"],
  },
  {
    id: "exp-2",
    text: "In your experience, what are the biggest gaps between available patient data and actionable clinical insights?",
    category: "data-gaps",
    assessmentFocus: ["CM", "DI"],
  },
  {
    id: "exp-3",
    text: "How do you currently integrate lifestyle data (diet, exercise, sleep) with clinical biomarkers in patient care?",
    category: "integration-practices",
    assessmentFocus: ["DI"],
  },
  {
    id: "exp-4",
    text: "What would an ideal AI-assisted tool for metabolic health monitoring look like from a clinical standpoint?",
    category: "ai-tool-vision",
    assessmentFocus: ["DL", "CM"],
  },
  {
    id: "exp-5",
    text: "How do you assess patient health literacy and their ability to understand test results?",
    category: "patient-literacy",
    assessmentFocus: ["HL"],
  },
  {
    id: "exp-6",
    text: "What ethical concerns do you have about AI tools that provide health risk assessments to patients?",
    category: "ethics",
    assessmentFocus: ["PR"],
  },
  {
    id: "exp-7",
    text: "Describe your approach to motivating patients toward preventive health behaviors.",
    category: "behavior-change",
    assessmentFocus: ["PR"],
  },
  {
    id: "exp-8",
    text: "How do you balance 'precise' clinical data with 'rough' patient-reported outcomes in decision-making?",
    category: "data-quality",
    assessmentFocus: ["DI", "CM"],
  },
  {
    id: "exp-9",
    text: "What role do you see for continuous glucose monitors or other wearables in routine care?",
    category: "digital-tools",
    assessmentFocus: ["DL", "CM"],
  },
  {
    id: "exp-10",
    text: "If a tool could predict early metabolic dysfunction, what threshold of certainty would you need to act on it?",
    category: "risk-thresholds",
    assessmentFocus: ["CM", "PR"],
  },
  {
    id: "exp-11",
    text: "What training or resources would help you integrate AI-driven health tools into your practice?",
    category: "adoption-barriers",
    assessmentFocus: ["DL"],
  },
];

// PLACEHOLDER: Adaptive question selection logic
export function selectNextQuestion(
  sessionState: any,
  participantType: 'general_public' | 'healthcare_expert'
): InterviewQuestion | null {
  // TODO: Implement intelligent question selection based on:
  // - Session phase
  // - Evidence gaps in dimensions
  // - Follow-up needs from previous responses
  // - Participant engagement level
  
  // For now, return null (to be implemented)
  return null;
}

// PLACEHOLDER: Question progression rules
export interface ProgressionRule {
  condition: (state: any) => boolean;
  nextQuestionId: string;
  reason: string;
}

export const QUESTION_PROGRESSION_RULES: ProgressionRule[] = [
  // TO BE IMPLEMENTED
  // Example structure:
  // {
  //   condition: (state) => state.dimensions.HL?.confidence === 'low',
  //   nextQuestionId: 'gp-3',
  //   reason: 'Low confidence in Health Literacy - probe clinical awareness'
  // }
];
