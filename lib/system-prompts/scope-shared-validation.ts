/**
 * S.C.O.P.E. Coach - Shared Validation Logic
 *
 * This module contains validation criteria and Yama principles
 * used by both Sequential and Natural conversation modes.
 */

// Type definitions for validation criteria
export interface ValidationCriterion {
  description: string;
  goodExample: string;
  badExample: string;
  checkFunction: string; // Function signature as string for LLM understanding
}

export interface YamaPrinciple {
  name: string;
  sanskrit: string;
  principle: string;
  applicationInSCOPE: string;
  checkFunction: string;
}

// Validation criteria for all 5 S.C.O.P.E. components
export const VALIDATION_CRITERIA: Record<string, ValidationCriterion> = {
  situation: {
    description: "The context must be specific, observable, and recent. It should describe WHO, WHAT, WHEN, and WHERE without interpretation or judgment.",
    goodExample: "Yesterday during our team standup, my colleague interrupted me three times while I was presenting my update.",
    badExample: "My colleague is always rude and doesn't respect me.",
    checkFunction: `
function validateSituation(situation: string): ValidationResult {
  const checks = {
    hasTimeframe: /yesterday|today|last week|on monday|during|at \\d/i.test(situation),
    hasLocation: /in the|at the|during the|meeting|office|call/i.test(situation),
    isObservable: !/(always|never|constantly|every time)/i.test(situation),
    avoidLabels: !/(rude|disrespectful|lazy|incompetent|toxic)/i.test(situation),
    isSpecific: situation.split(' ').length >= 8
  };

  return {
    isValid: Object.values(checks).filter(Boolean).length >= 4,
    checks,
    suggestions: generateSuggestions(checks)
  };
}`
  },

  choices: {
    description: "Must present 3-5 distinct, actionable response options. Each choice should be concrete, within the user's control, and represent genuinely different approaches.",
    goodExample: "[1] Ask for a private conversation to discuss meeting dynamics [2] Use a hand signal during meetings to indicate you're not finished [3] Send a follow-up email summarizing your points [4] Address it in real-time: 'I'd like to finish my thought'",
    badExample: "[1] Tell them to stop [2] Report them to HR [3] Quit your job",
    checkFunction: `
function validateChoices(choices: string[]): ValidationResult {
  const checks = {
    hasMinimumOptions: choices.length >= 3,
    hasMaximumOptions: choices.length <= 5,
    allActionable: choices.every(c => /ask|tell|send|schedule|create|document|request/i.test(c)),
    distinctApproaches: areDistinct(choices),
    withinControl: choices.every(c => !/(make them|force them|they should)/i.test(c)),
    proportionate: choices.every(c => !/(quit|resign|sue|report to police)/i.test(c) || contextWarrants(c))
  };

  return {
    isValid: Object.values(checks).filter(Boolean).length >= 5,
    checks,
    suggestions: generateSuggestions(checks)
  };
}`
  },

  outcomes: {
    description: "Each choice must have realistic positive AND negative potential outcomes. Outcomes should be specific and proportionate to the action.",
    goodExample: "Choice 1 outcomes: (+) Could clear the air and improve future meetings (-) They might become defensive or deny the behavior (+) Shows maturity and direct communication (-) Might feel awkward temporarily",
    badExample: "Choice 1: Everything will be great! / Choice 2: They'll hate you forever.",
    checkFunction: `
function validateOutcomes(outcomes: OutcomeSet[]): ValidationResult {
  const checks = {
    hasPositivesAndNegatives: outcomes.every(o => o.positive.length > 0 && o.negative.length > 0),
    isBalanced: outcomes.every(o => Math.abs(o.positive.length - o.negative.length) <= 1),
    isRealistic: outcomes.every(o => !containsExtremes(o)),
    isSpecific: outcomes.every(o => o.positive.concat(o.negative).every(s => s.split(' ').length >= 5)),
    matchesChoice: outcomes.every((o, i) => outcomeMatchesChoice(o, choices[i]))
  };

  return {
    isValid: Object.values(checks).filter(Boolean).length >= 4,
    checks,
    suggestions: generateSuggestions(checks)
  };
}`
  },

  purpose: {
    description: "Must capture the deeper WHY behind the conversation. Should reflect personal values, relationship goals, or long-term outcomes that matter to the user.",
    goodExample: "I want to maintain a collaborative relationship with my colleague while ensuring my contributions are heard. I value mutual respect and want to model the communication standards I expect from others.",
    badExample: "I want to win. / I want them to know they're wrong.",
    checkFunction: `
function validatePurpose(purpose: string): ValidationResult {
  const checks = {
    hasDepth: purpose.split(' ').length >= 15,
    reflectsValues: /(value|important to me|believe|care about|matters)/i.test(purpose),
    futureOriented: /(want to|hope to|aim to|goal is|long-term)/i.test(purpose),
    relationalAwareness: /(relationship|team|collaboration|trust|respect)/i.test(purpose),
    avoidsVengenance: !/(revenge|punish|make them pay|teach them a lesson)/i.test(purpose),
    constructive: /(improve|build|maintain|create|develop|strengthen)/i.test(purpose)
  };

  return {
    isValid: Object.values(checks).filter(Boolean).length >= 4,
    checks,
    suggestions: generateSuggestions(checks)
  };
}`
  },

  engagement: {
    description: "Defines HOW the conversation will be conducted. Includes tone, timing, setting, and specific communication techniques.",
    goodExample: "I'll request a 15-minute private meeting in a neutral space like the coffee area. I'll use 'I' statements, maintain calm body language, and start by acknowledging their expertise before sharing my observation.",
    badExample: "I'll just talk to them.",
    checkFunction: `
function validateEngagement(engagement: string): ValidationResult {
  const checks = {
    hasFormat: /(meeting|call|email|in-person|video|chat)/i.test(engagement),
    hasTiming: /(before|after|during|morning|afternoon|when|\\d+ minutes)/i.test(engagement),
    hasTone: /(calm|respectful|direct|warm|professional|assertive)/i.test(engagement),
    hasTechniques: /(I statement|active listening|paraphrase|open question)/i.test(engagement),
    hasContingency: /(if they|in case|should they|alternatively)/i.test(engagement),
    isSpecific: engagement.split(' ').length >= 20
  };

  return {
    isValid: Object.values(checks).filter(Boolean).length >= 4,
    checks,
    suggestions: generateSuggestions(checks)
  };
}`
  }
};

// Yama principles - Constitutional guardrails
export const YAMA_PRINCIPLES: Record<string, YamaPrinciple> = {
  ahimsa: {
    name: "Ahimsa",
    sanskrit: "अहिंसा",
    principle: "Non-harm in thought, word, and deed",
    applicationInSCOPE: "Generated scripts must not include language designed to hurt, manipulate, or demean. Even assertive boundary-setting should be firm but not cruel.",
    checkFunction: `
function checkAhimsa(content: string): YamaCheckResult {
  const violations = [];

  // Check for harmful language patterns
  if (/(you always|you never|you're such a)/i.test(content)) {
    violations.push('Absolute statements that attack character');
  }
  if (/(idiot|stupid|incompetent|worthless)/i.test(content)) {
    violations.push('Demeaning labels');
  }
  if (/(make them feel|hurt them|get back at)/i.test(content)) {
    violations.push('Intent to cause emotional harm');
  }
  if (/(threaten|intimidate|scare them)/i.test(content)) {
    violations.push('Coercive or threatening language');
  }

  return {
    principle: 'Ahimsa',
    passed: violations.length === 0,
    violations,
    remediation: violations.length > 0
      ? 'Reframe to focus on behavior and impact, not character attacks'
      : null
  };
}`
  },

  satya: {
    name: "Satya",
    sanskrit: "सत्य",
    principle: "Truthfulness and authenticity",
    applicationInSCOPE: "Scripts should express genuine feelings and observations without exaggeration, minimization, or strategic deception.",
    checkFunction: `
function checkSatya(content: string): YamaCheckResult {
  const violations = [];

  // Check for deceptive patterns
  if (/(pretend|act like|fake|make them think)/i.test(content)) {
    violations.push('Encourages deception or manipulation');
  }
  if (/(everyone thinks|nobody likes|the whole team)/i.test(content)) {
    violations.push('Unverifiable generalizations presented as fact');
  }
  if (/(exaggerate|overstate|embellish)/i.test(content)) {
    violations.push('Encourages misrepresentation');
  }
  if (/(hide the real reason|don't tell them why)/i.test(content)) {
    violations.push('Strategic withholding of relevant truth');
  }

  return {
    principle: 'Satya',
    passed: violations.length === 0,
    violations,
    remediation: violations.length > 0
      ? 'Express your actual observations and feelings directly'
      : null
  };
}`
  },

  asteya: {
    name: "Asteya",
    sanskrit: "अस्तेय",
    principle: "Non-stealing, including credit, time, and dignity",
    applicationInSCOPE: "Conversations should respect the other person's time, acknowledge their contributions, and not seek to diminish their standing.",
    checkFunction: `
function checkAsteya(content: string): YamaCheckResult {
  const violations = [];

  // Check for stealing patterns
  if (/(take credit|claim their|my idea first)/i.test(content)) {
    violations.push('Attempts to claim undue credit');
  }
  if (/(waste their time|make them wait|keep them guessing)/i.test(content)) {
    violations.push('Disrespect for others time');
  }
  if (/(undermine|sabotage|make them look bad)/i.test(content)) {
    violations.push('Attempts to steal dignity or reputation');
  }
  if (/(ambush|surprise attack|catch off guard)/i.test(content)) {
    violations.push('Denying opportunity for preparation');
  }

  return {
    principle: 'Asteya',
    passed: violations.length === 0,
    violations,
    remediation: violations.length > 0
      ? 'Approach with respect for their time, contributions, and dignity'
      : null
  };
}`
  },

  brahmacharya: {
    name: "Brahmacharya",
    sanskrit: "ब्रह्मचर्य",
    principle: "Right use of energy, moderation, focus",
    applicationInSCOPE: "Scripts should be appropriately sized for the issue, not over-investing energy in minor issues or under-investing in major ones.",
    checkFunction: `
function checkBrahmacharya(content: string, contextSeverity: number): YamaCheckResult {
  const violations = [];

  const contentIntensity = calculateIntensity(content);

  // Check for energy misallocation
  if (contextSeverity < 3 && contentIntensity > 7) {
    violations.push('Over-escalation: response intensity exceeds issue severity');
  }
  if (contextSeverity > 7 && contentIntensity < 3) {
    violations.push('Under-response: serious issue requires more substantial engagement');
  }
  if (/(every single|all the time|this is the last straw)/i.test(content) && contextSeverity < 5) {
    violations.push('Emotional flooding language for moderate issue');
  }
  if (content.split(' ').length > 500) {
    violations.push('Excessive length may dilute key message');
  }

  return {
    principle: 'Brahmacharya',
    passed: violations.length === 0,
    violations,
    remediation: violations.length > 0
      ? 'Calibrate response intensity to match the actual severity of the situation'
      : null
  };
}`
  },

  aparigraha: {
    name: "Aparigraha",
    sanskrit: "अपरिग्रह",
    principle: "Non-grasping, releasing attachment to specific outcomes",
    applicationInSCOPE: "Scripts should advocate for needs while remaining open to dialogue. The goal is understanding, not forcing compliance.",
    checkFunction: `
function checkAparigraha(content: string): YamaCheckResult {
  const violations = [];

  // Check for grasping patterns
  if (/(must|have to|need to|you will)/i.test(content) && !/(I must|I need)/i.test(content)) {
    violations.push('Demanding specific behaviors from others');
  }
  if (/(or else|otherwise|consequences will be)/i.test(content)) {
    violations.push('Ultimatum-based approach');
  }
  if (/(admit|acknowledge|apologize).*(wrong|fault|mistake)/i.test(content)) {
    violations.push('Demanding specific emotional responses');
  }
  if (!/(understand|curious|open to|your perspective)/i.test(content)) {
    violations.push('Lacks openness to dialogue and other viewpoints');
  }

  return {
    principle: 'Aparigraha',
    passed: violations.length === 0,
    violations,
    remediation: violations.length > 0
      ? 'Express your needs while remaining genuinely open to their perspective'
      : null
  };
}`
  }
};

// Helper type definitions for LLM understanding
export interface ValidationResult {
  isValid: boolean;
  checks: Record<string, boolean>;
  suggestions: string[];
}

export interface YamaCheckResult {
  principle: string;
  passed: boolean;
  violations: string[];
  remediation: string | null;
}

export interface OutcomeSet {
  choiceIndex: number;
  positive: string[];
  negative: string[];
}

// Export a combined validation runner example for the LLM
export const FULL_VALIDATION_EXAMPLE = `
// Complete validation flow
async function validateSCOPEComponents(components: SCOPEComponents): Promise<ValidationReport> {
  const results = {
    situation: validateSituation(components.situation),
    choices: validateChoices(components.choices),
    outcomes: validateOutcomes(components.outcomes),
    purpose: validatePurpose(components.purpose),
    engagement: validateEngagement(components.engagement)
  };

  const yamaChecks = YAMA_PRINCIPLES.map(yama =>
    yama.checkFunction(generateDraftScript(components))
  );

  const allValid = Object.values(results).every(r => r.isValid);
  const yamasPassed = yamaChecks.every(c => c.passed);

  return {
    componentResults: results,
    yamaResults: yamaChecks,
    overallValid: allValid && yamasPassed,
    readyForScriptGeneration: allValid && yamasPassed
  };
}`;
