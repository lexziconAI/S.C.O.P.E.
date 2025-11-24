/**
 * S.C.O.P.E. Quality Validator
 *
 * Validates each S.C.O.P.E. component against quality criteria using
 * pattern matching, keyword detection, and linguistic heuristics.
 *
 * This provides fast, local validation without requiring API calls,
 * complementing the LLM-based component extractor.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ComponentType = 'situation' | 'choices' | 'outcomes' | 'purpose' | 'engagement';

export interface CriterionResult {
  criterion: string;
  passed: boolean;
  score: number; // 0-1
  feedback: string;
  evidence?: string[];
}

export interface ValidationResult {
  component: ComponentType;
  content: string;
  criteria: CriterionResult[];
  overallScore: number;
  isValid: boolean;
  summary: string;
}

// ============================================================================
// WORD LISTS AND PATTERNS
// ============================================================================

// Past tense patterns
const PAST_TENSE_PATTERNS = [
  /\b(was|were|had|did|went|came|made|got|took|gave|found|said|told|thought|felt|saw|knew|became|brought|left|kept|let|began|showed|heard|played|ran|moved|paid|met|bought|spent|caught|learned|learned|understood|chose|decided|realized|discovered|experienced|happened|occurred|existed|worked|helped|tried|asked|needed|seemed|wanted|liked|loved|hated|feared|hoped|wished|believed|remembered|forgot|imagined)\b/i,
  /\b\w+ed\b/i, // Regular past tense
  /\b(yesterday|last week|last month|last year|earlier|previously|before|ago|back then|at that time|in the past|once|formerly)\b/i,
];

// Time and place markers
const TIME_PLACE_MARKERS = [
  // Time markers
  /\b(yesterday|today|tomorrow|last|next|this|morning|afternoon|evening|night|week|month|year|ago|recently|earlier|later|before|after|during|since|until|when|while)\b/i,
  // Place markers
  /\b(at|in|on|here|there|where|office|home|work|meeting|room|building|location|place|site|area|department|team|company|organization)\b/i,
  // Specific time patterns
  /\b\d{1,2}:\d{2}\b/, // Time like 2:30
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
];

// Action verbs
const ACTION_VERBS = [
  /\b(do|does|did|make|made|get|got|take|took|give|gave|go|went|come|came|see|saw|know|knew|think|thought|use|used|find|found|tell|told|ask|asked|work|worked|try|tried|leave|left|call|called|keep|kept|let|put|show|showed|begin|began|help|helped|talk|talked|turn|turned|start|started|might|could|would|should|can|will|shall|must|may|decide|decided|choose|chose|consider|considered|plan|planned|intend|intended)\b/i,
];

// Attitude and consideration words
const ATTITUDE_WORDS = [
  /\b(think|thought|feel|felt|believe|believed|consider|considered|wonder|wondered|suppose|supposed|assume|assumed|expect|expected|hope|hoped|wish|wished|prefer|preferred|want|wanted|like|liked|love|loved|hate|hated|fear|feared|worry|worried|concern|concerned|care|cared|mind|minded|appreciate|appreciated|value|valued|understand|understood|realize|realized|recognize|recognized|acknowledge|acknowledged|accept|accepted|agree|agreed|disagree|disagreed)\b/i,
];

// Outcome-related patterns
const PROXIMAL_OUTCOME_WORDS = [
  /\b(immediate|immediately|right away|instantly|quickly|soon|shortly|now|directly|at once|straight away|first|initial|early|near-term|short-term)\b/i,
];

const DISTAL_OUTCOME_WORDS = [
  /\b(long-term|future|eventually|ultimately|later|down the road|in the end|over time|gradually|someday|years from now|lasting|permanent|sustained|ongoing|continuous|lifelong)\b/i,
];

const VISIBLE_OUTCOME_WORDS = [
  /\b(see|saw|seen|visible|observable|noticeable|apparent|evident|obvious|clear|manifest|tangible|concrete|measurable|quantifiable|demonstrate|demonstrated|show|showed|display|displayed|exhibit|exhibited|performance|behavior|result|outcome|effect|impact|change|improvement|progress|achievement|accomplishment|success|failure|metrics|numbers|data|statistics)\b/i,
];

const INTERNAL_OUTCOME_WORDS = [
  /\b(feel|felt|feeling|emotion|emotional|mood|attitude|mindset|perspective|outlook|confidence|self-esteem|motivation|satisfaction|fulfillment|happiness|joy|peace|calm|anxiety|stress|frustration|anger|fear|hope|relief|pride|shame|guilt|regret|understanding|awareness|insight|growth|development|learning|wisdom|maturity|resilience|well-being|mental|psychological|internal|inner|personal)\b/i,
];

const CAUSALITY_PATTERNS = [
  /\b(because|since|therefore|thus|hence|consequently|as a result|due to|owing to|caused by|leads to|results in|brings about|contributes to|affects|influences|impacts|determines|creates|produces|generates|triggers|sparks|enables|allows|prevents|stops|if.*then|when.*will|so that|in order to)\b/i,
];

const PUNITIVE_WORDS = [
  /\b(punish|punishment|penalty|consequence|discipline|sanction|reprimand|warning|probation|termination|fire|fired|dismiss|dismissed|suspend|suspended|demote|demoted|cut|reduce|eliminate|remove|take away|revoke|restrict|limit|ban|forbid|prohibit|enforce|strict|harsh|severe|tough)\b/i,
];

const CAPABILITY_BUILDING_WORDS = [
  /\b(develop|development|grow|growth|learn|learning|improve|improvement|enhance|enhancement|strengthen|build|building|cultivate|foster|nurture|support|coach|coaching|mentor|mentoring|train|training|educate|education|skill|skills|capability|capabilities|competency|competencies|potential|opportunity|opportunities|empower|empowerment|enable|resource|resources|invest|investment)\b/i,
];

// Purpose-related patterns
const VALUE_WORDS = [
  /\b(value|values|principle|principles|belief|beliefs|integrity|honesty|trust|respect|fairness|justice|equality|dignity|compassion|empathy|kindness|care|responsibility|accountability|commitment|dedication|excellence|quality|innovation|creativity|collaboration|teamwork|community|family|health|well-being|happiness|fulfillment|meaning|purpose|legacy|impact|contribution|service|authenticity|growth|learning|freedom|autonomy|independence)\b/i,
];

const GOAL_WORDS = [
  /\b(goal|goals|objective|objectives|aim|aims|target|targets|aspiration|aspirations|ambition|ambitions|dream|dreams|vision|mission|purpose|direction|destination|milestone|achievement|accomplishment|success|outcome|result|benchmark|standard|expectation|plan|strategy|priority|priorities|focus|intention|intention|commitment|desire|want|hope|wish|strive|pursue|seek|work toward|achieve|accomplish|reach|attain|fulfill)\b/i,
];

const COERCIVE_PATTERNS = [
  /\b(must|have to|need to|should|ought to|required|mandatory|compulsory|obligatory|forced|coerced|pressured|demanded|commanded|ordered|dictated|imposed|threatened|ultimatum|or else|no choice|no option|non-negotiable)\b/i,
];

const INSPIRING_PATTERNS = [
  /\b(inspire|inspired|inspiring|motivation|motivate|motivated|motivating|encourage|encouraged|encouraging|empower|empowered|empowering|uplift|uplifted|uplifting|energize|energized|energizing|excite|excited|exciting|passionate|passion|enthusiasm|enthusiastic|vision|visionary|possibility|possibilities|potential|opportunity|opportunities|imagine|dream|aspire|hope|believe|trust|faith|confidence|optimism|optimistic|positive|possibility|transform|transformation|create|creation|innovate|innovation|pioneer|lead|leadership)\b/i,
];

const DISCIPLINARY_PATTERNS = [
  /\b(discipline|disciplinary|punishment|punish|penalize|penalty|sanction|warning|probation|suspension|termination|consequences|repercussions|accountability|responsible|fault|blame|error|mistake|violation|infraction|misconduct|performance issue|improvement plan|corrective action|write-up|documentation|HR|human resources)\b/i,
];

const DEVELOPMENTAL_PATTERNS = [
  /\b(develop|developmental|growth|grow|learn|learning|improve|improvement|enhance|skill|skills|capability|capabilities|potential|opportunity|coaching|mentoring|training|education|feedback|support|guidance|career|professional development|personal development|stretch assignment|challenge|experience|exposure|knowledge|competency|talent|succession|future|long-term)\b/i,
];

// Engagement-related patterns
const YES_NO_PATTERNS = [
  /^(do you|are you|can you|will you|would you|could you|should you|have you|did you|is it|was it|were you)\b/i,
  /\?$/, // Ends with question mark (potential yes/no)
];

const OPEN_QUESTION_PATTERNS = [
  /\b(what|how|why|tell me|describe|explain|share|elaborate|walk me through|help me understand|in what way|to what extent)\b/i,
];

const DISSENT_INVITING_PATTERNS = [
  /\b(what do you think|how do you feel|your perspective|your view|your opinion|agree or disagree|see it differently|other ideas|alternative|another way|push back|challenge|question|concern|reservation|hesitation|worry|doubt|different approach)\b/i,
];

const COLLABORATIVE_PATTERNS = [
  /\b(we|us|our|together|collaborate|collaboration|partner|partnership|team|jointly|mutually|shared|collective|co-create|co-design|brainstorm|explore together|work together|figure out together|let's|both|all of us)\b/i,
];

const DIRECTIVE_PATTERNS = [
  /\b(you must|you need to|you should|you have to|you will|I want you to|I need you to|I expect you to|make sure|ensure|do this|don't do|stop|start|always|never|immediately|right now|by tomorrow|no exceptions)\b/i,
];

// Abstract vs concrete detection
const ABSTRACT_PATTERNS = [
  /\b(always|never|everyone|no one|nobody|everything|nothing|all|none|generally|usually|typically|normally|often|sometimes|rarely|probably|possibly|maybe|perhaps|seems|appears|tends|kind of|sort of|stuff|things|situation|issue|matter|concern|aspect|factor|element|component|concept|idea|notion|theory|philosophy|approach|method|way|manner|style|type|form)\b/i,
];

const CONCRETE_PATTERNS = [
  /\b(specifically|exactly|precisely|actually|literally|particularly|especially|namely|for example|for instance|such as|like when|the time when|that day|that moment|that meeting|that conversation|that email|that call|that project|that person|John|Mary|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i, // Names and specific references
  /\b\d+\b/, // Numbers
  /\b\$[\d,]+\b/, // Dollar amounts
  /\b\d+%\b/, // Percentages
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Check if text contains past tense indicators
 */
export function hasPastTense(text: string): CriterionResult {
  const matches: string[] = [];
  let score = 0;

  for (const pattern of PAST_TENSE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
      score += 0.4;
    }
  }

  score = Math.min(score, 1);
  const passed = score >= 0.5;

  return {
    criterion: 'past_tense',
    passed,
    score,
    feedback: passed
      ? `Found past tense indicators: ${matches.slice(0, 3).join(', ')}`
      : 'Missing clear past tense framing. Consider using "was", "happened", "occurred".',
    evidence: matches.slice(0, 5),
  };
}

/**
 * Check if text contains time or place markers
 */
export function hasTimeOrPlaceMarkers(text: string): CriterionResult {
  const matches: string[] = [];
  let score = 0;

  for (const pattern of TIME_PLACE_MARKERS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
      score += 0.25;
    }
  }

  score = Math.min(score, 1);
  const passed = score >= 0.5;

  return {
    criterion: 'time_place_markers',
    passed,
    score,
    feedback: passed
      ? `Found time/place markers: ${matches.slice(0, 4).join(', ')}`
      : 'Lacking specific time or place references. Add when and where this occurred.',
    evidence: matches.slice(0, 5),
  };
}

/**
 * Check if text is abstract (negative indicator for situation)
 */
export function isAbstract(text: string): CriterionResult {
  const abstractMatches: string[] = [];
  const concreteMatches: string[] = [];

  for (const pattern of ABSTRACT_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      abstractMatches.push(...matches.slice(0, 3));
    }
  }

  for (const pattern of CONCRETE_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      concreteMatches.push(...matches.slice(0, 3));
    }
  }

  const abstractCount = abstractMatches.length;
  const concreteCount = concreteMatches.length;

  // Higher score means MORE abstract (which is bad for situation)
  const score = abstractCount > 0
    ? Math.min(abstractCount / (abstractCount + concreteCount + 1), 1)
    : 0;

  const passed = score < 0.5; // Pass if NOT too abstract

  return {
    criterion: 'concreteness',
    passed,
    score: 1 - score, // Invert so higher is better
    feedback: passed
      ? `Content is sufficiently concrete with specific details.`
      : `Content is too abstract. Found generalizations: ${abstractMatches.slice(0, 3).join(', ')}. Add specific examples.`,
    evidence: passed ? concreteMatches.slice(0, 3) : abstractMatches.slice(0, 3),
  };
}

/**
 * Check if text relates to observable events
 */
export function relatesTo(text: string, context: string): CriterionResult {
  // Check for observability indicators
  const observablePatterns = [
    /\b(saw|heard|noticed|observed|witnessed|experienced|felt|sensed|detected|discovered|found|realized|recognized|identified|encounter|happened|occurred|took place)\b/i,
  ];

  const matches: string[] = [];
  for (const pattern of observablePatterns) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.3, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'observable_event',
    passed,
    score,
    feedback: passed
      ? `References observable event: ${matches.join(', ')}`
      : 'Make the event more observable. What could someone else have seen or heard?',
    evidence: matches,
  };
}

/**
 * Check if text contains action verbs
 */
export function hasActionVerbs(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of ACTION_VERBS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches);
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const passed = score >= 0.4;

  return {
    criterion: 'action_verbs',
    passed,
    score,
    feedback: passed
      ? `Contains action verbs: ${uniqueMatches.slice(0, 5).join(', ')}`
      : 'Add more action verbs to describe what was done or could be done.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if text contains attitude/consideration words
 */
export function hasAttitudeWords(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of ATTITUDE_WORDS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches);
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.25, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'attitude_words',
    passed,
    score,
    feedback: passed
      ? `Shows consideration with words like: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Express more about thoughts, feelings, or considerations around the choices.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if choices are clearly articulated
 */
export function hasActionClarity(text: string): CriterionResult {
  // Look for clear option/alternative language
  const clarityPatterns = [
    /\b(option|options|alternative|alternatives|choice|choices|could|might|either.*or|whether to|decide between|consider|path|route|approach|way forward)\b/i,
    /\b(first option|second option|third option|one way|another way|on one hand|on the other hand)\b/i,
  ];

  const matches: string[] = [];
  for (const pattern of clarityPatterns) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.35, 1);
  const passed = score >= 0.35;

  return {
    criterion: 'action_clarity',
    passed,
    score,
    feedback: passed
      ? `Choices are clearly articulated: ${matches.join(', ')}`
      : 'Clarify the specific options or alternatives being considered.',
    evidence: matches,
  };
}

/**
 * Check if action requires others' permission
 */
export function requiresOthersPermission(text: string): CriterionResult {
  const permissionPatterns = [
    /\b(permission|approval|authorize|authorization|sign-off|green light|go-ahead|consent|allow|allowed|permit|permitted|check with|run by|ask|need.*approval|get.*okay|clear with|dependent on|waiting for|requires.*sign|up to them|their decision|not my call)\b/i,
  ];

  const matches: string[] = [];
  for (const pattern of permissionPatterns) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const found = matches.length > 0;

  return {
    criterion: 'requires_permission',
    passed: true, // This is informational, not pass/fail
    score: found ? 1 : 0,
    feedback: found
      ? `Action requires external permission: ${matches.join(', ')}. Consider discussing contingency plans.`
      : 'Action appears within personal control.',
    evidence: matches,
  };
}

/**
 * Check if two texts are similar in meaning
 */
export function areSimilar(text1: string, text2: string): CriterionResult {
  // Simple word overlap similarity
  const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  const similarity = union.size > 0 ? intersection.size / union.size : 0;
  const passed = similarity < 0.7; // Pass if not too similar (looking for contradictions)

  return {
    criterion: 'similarity',
    passed,
    score: 1 - similarity,
    feedback: passed
      ? 'Statements show appropriate variation.'
      : 'Statements are very similar, which may indicate redundancy or lack of development.',
    evidence: [...intersection].slice(0, 5),
  };
}

/**
 * Check if outcome is proximal (immediate)
 */
export function isProximal(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of PROXIMAL_OUTCOME_WORDS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.4, 1);
  const found = score > 0;

  return {
    criterion: 'proximal_outcomes',
    passed: found,
    score,
    feedback: found
      ? `Includes immediate/short-term outcomes: ${matches.join(', ')}`
      : 'Consider adding immediate consequences or results.',
    evidence: matches,
  };
}

/**
 * Check if outcome is long-term
 */
export function isLongTerm(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of DISTAL_OUTCOME_WORDS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.4, 1);
  const found = score > 0;

  return {
    criterion: 'long_term_outcomes',
    passed: found,
    score,
    feedback: found
      ? `Includes long-term outcomes: ${matches.join(', ')}`
      : 'Consider adding long-term consequences or implications.',
    evidence: matches,
  };
}

/**
 * Check if outcome is visible/external
 */
export function isVisible(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of VISIBLE_OUTCOME_WORDS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches.slice(0, 3));
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const found = score >= 0.2;

  return {
    criterion: 'visible_outcomes',
    passed: found,
    score,
    feedback: found
      ? `Includes observable outcomes: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Add outcomes that others could observe or measure.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if outcome is internal/emotional
 */
export function isInternal(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of INTERNAL_OUTCOME_WORDS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches.slice(0, 3));
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const found = score >= 0.2;

  return {
    criterion: 'internal_outcomes',
    passed: found,
    score,
    feedback: found
      ? `Includes internal/emotional outcomes: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Consider how this affects feelings, confidence, or well-being.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if text shows clear causality
 */
export function hasClearCausality(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of CAUSALITY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.3, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'clear_causality',
    passed,
    score,
    feedback: passed
      ? `Shows cause-effect reasoning: ${matches.join(', ')}`
      : 'Make the connection between action and outcome more explicit.',
    evidence: matches,
  };
}

/**
 * Check if framing is punitive
 */
export function isPunitive(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of PUNITIVE_WORDS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.3, 1);
  const found = score > 0;

  return {
    criterion: 'punitive_framing',
    passed: !found, // Pass if NOT punitive
    score: 1 - score,
    feedback: found
      ? `Contains punitive language: ${matches.join(', ')}. Consider reframing toward growth.`
      : 'Framing avoids punitive language.',
    evidence: matches,
  };
}

/**
 * Check if framing is capability-building
 */
export function isCapabilityBuilding(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of CAPABILITY_BUILDING_WORDS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches.slice(0, 3));
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'capability_building',
    passed,
    score,
    feedback: passed
      ? `Focuses on growth and development: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Frame outcomes in terms of growth, learning, and capability development.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if text connects to values
 */
export function connectsToValues(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of VALUE_WORDS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches.slice(0, 3));
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'connects_to_values',
    passed,
    score,
    feedback: passed
      ? `Connects to values: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Explore what values or principles are at stake.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if text connects to goals
 */
export function connectsToGoals(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of GOAL_WORDS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches.slice(0, 3));
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'connects_to_goals',
    passed,
    score,
    feedback: passed
      ? `Connects to goals: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Link this to broader objectives or aspirations.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if framing is coercive
 */
export function isCoercive(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of COERCIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.3, 1);
  const found = score > 0;

  return {
    criterion: 'coercive_framing',
    passed: !found, // Pass if NOT coercive
    score: 1 - score,
    feedback: found
      ? `Contains coercive language: ${matches.join(', ')}. Reframe to preserve autonomy.`
      : 'Language respects autonomy and choice.',
    evidence: matches,
  };
}

/**
 * Check if text is inspiring
 */
export function inspires(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of INSPIRING_PATTERNS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches.slice(0, 3));
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'inspiring',
    passed,
    score,
    feedback: passed
      ? `Uses inspiring language: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Frame the purpose in a way that inspires and motivates.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if framing is disciplinary
 */
export function isDisciplinary(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of DISCIPLINARY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.3, 1);
  const found = score > 0;

  return {
    criterion: 'disciplinary_framing',
    passed: !found, // Pass if NOT disciplinary
    score: 1 - score,
    feedback: found
      ? `Contains disciplinary framing: ${matches.join(', ')}. Shift toward developmental approach.`
      : 'Avoids disciplinary or punitive framing.',
    evidence: matches,
  };
}

/**
 * Check if framing is developmental
 */
export function isDevelopmental(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of DEVELOPMENTAL_PATTERNS) {
    const allMatches = text.match(new RegExp(pattern.source, 'gi'));
    if (allMatches) {
      matches.push(...allMatches.slice(0, 3));
    }
  }

  const uniqueMatches = [...new Set(matches)];
  const score = Math.min(uniqueMatches.length * 0.2, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'developmental',
    passed,
    score,
    feedback: passed
      ? `Uses developmental framing: ${uniqueMatches.slice(0, 4).join(', ')}`
      : 'Frame the purpose in terms of growth and development.',
    evidence: uniqueMatches.slice(0, 5),
  };
}

/**
 * Check if question is yes/no format
 */
export function isYesNoQuestion(text: string): CriterionResult {
  const isYesNo = YES_NO_PATTERNS.some(pattern => pattern.test(text));
  const isOpen = OPEN_QUESTION_PATTERNS.some(pattern => pattern.test(text));

  // If it's open format, that's good
  const passed = !isYesNo || isOpen;
  const score = isOpen ? 1 : (isYesNo ? 0 : 0.5);

  return {
    criterion: 'open_question_format',
    passed,
    score,
    feedback: passed
      ? 'Uses open question format that invites elaboration.'
      : 'Consider rephrasing as an open question (what, how, why).',
  };
}

/**
 * Check if question invites dissent
 */
export function invitesDissent(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of DISSENT_INVITING_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.35, 1);
  const passed = score >= 0.3;

  return {
    criterion: 'invites_dissent',
    passed,
    score,
    feedback: passed
      ? `Invites alternative perspectives: ${matches.join(', ')}`
      : 'Create space for disagreement or alternative viewpoints.',
    evidence: matches,
  };
}

/**
 * Check if language is collaborative
 */
export function isCollaborative(text: string): CriterionResult {
  const collabMatches: string[] = [];
  const directiveMatches: string[] = [];

  for (const pattern of COLLABORATIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      collabMatches.push(match[0]);
    }
  }

  for (const pattern of DIRECTIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      directiveMatches.push(match[0]);
    }
  }

  const collabScore = collabMatches.length * 0.3;
  const directivePenalty = directiveMatches.length * 0.3;
  const score = Math.max(0, Math.min(collabScore - directivePenalty + 0.5, 1));
  const passed = score >= 0.5;

  return {
    criterion: 'collaborative',
    passed,
    score,
    feedback: passed
      ? `Uses collaborative language: ${collabMatches.join(', ')}`
      : `Too directive. ${directiveMatches.length > 0 ? `Found: ${directiveMatches.join(', ')}. ` : ''}Use more collaborative framing.`,
    evidence: passed ? collabMatches : directiveMatches,
  };
}

/**
 * Check if language is directive
 */
export function isDirective(text: string): CriterionResult {
  const matches: string[] = [];

  for (const pattern of DIRECTIVE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  const score = Math.min(matches.length * 0.3, 1);
  const found = score > 0;

  return {
    criterion: 'directive',
    passed: !found, // Pass if NOT directive
    score: 1 - score,
    feedback: found
      ? `Contains directive language: ${matches.join(', ')}. Consider more collaborative approach.`
      : 'Language is appropriately non-directive.',
    evidence: matches,
  };
}

// ============================================================================
// MAIN VALIDATOR CLASS
// ============================================================================

export class QualityValidator {
  /**
   * Validates a component against its quality criteria
   */
  validate(component: ComponentType, content: string): ValidationResult {
    const criteria: CriterionResult[] = [];

    switch (component) {
      case 'situation':
        criteria.push(
          hasPastTense(content),
          hasTimeOrPlaceMarkers(content),
          isAbstract(content),
          relatesTo(content, 'observable event')
        );
        break;

      case 'choices':
        criteria.push(
          hasActionVerbs(content),
          hasAttitudeWords(content),
          hasActionClarity(content),
          requiresOthersPermission(content)
        );
        break;

      case 'outcomes':
        criteria.push(
          isProximal(content),
          isLongTerm(content),
          isVisible(content),
          isInternal(content),
          hasClearCausality(content),
          isPunitive(content),
          isCapabilityBuilding(content)
        );
        break;

      case 'purpose':
        criteria.push(
          connectsToValues(content),
          connectsToGoals(content),
          isCoercive(content),
          inspires(content),
          isDisciplinary(content),
          isDevelopmental(content)
        );
        break;

      case 'engagement':
        criteria.push(
          isYesNoQuestion(content),
          invitesDissent(content),
          isCollaborative(content),
          isDirective(content)
        );
        break;
    }

    // Calculate overall score
    const overallScore = criteria.length > 0
      ? criteria.reduce((sum, c) => sum + c.score, 0) / criteria.length
      : 0;

    // Determine if valid (threshold varies by component)
    const validThreshold = 0.5;
    const isValid = overallScore >= validThreshold;

    // Generate summary
    const passedCount = criteria.filter(c => c.passed).length;
    const summary = `${component.charAt(0).toUpperCase() + component.slice(1)}: ${passedCount}/${criteria.length} criteria met (${(overallScore * 100).toFixed(0)}% quality score)`;

    return {
      component,
      content,
      criteria,
      overallScore,
      isValid,
      summary,
    };
  }

  /**
   * Validates all components in an extraction result
   */
  validateAll(components: Record<ComponentType, { content: string }>): Record<ComponentType, ValidationResult> {
    const results: Partial<Record<ComponentType, ValidationResult>> = {};

    for (const componentType of ['situation', 'choices', 'outcomes', 'purpose', 'engagement'] as ComponentType[]) {
      const component = components[componentType];
      if (component && component.content) {
        results[componentType] = this.validate(componentType, component.content);
      } else {
        results[componentType] = {
          component: componentType,
          content: '',
          criteria: [],
          overallScore: 0,
          isValid: false,
          summary: `${componentType.charAt(0).toUpperCase() + componentType.slice(1)}: No content to validate`,
        };
      }
    }

    return results as Record<ComponentType, ValidationResult>;
  }

  /**
   * Get validation suggestions for improving a component
   */
  getSuggestions(result: ValidationResult): string[] {
    return result.criteria
      .filter(c => !c.passed)
      .map(c => c.feedback);
  }

  /**
   * Calculate aggregate quality score across all components
   */
  calculateAggregateScore(results: Record<ComponentType, ValidationResult>): number {
    const scores = Object.values(results).map(r => r.overallScore);
    return scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
  }
}

export default QualityValidator;
