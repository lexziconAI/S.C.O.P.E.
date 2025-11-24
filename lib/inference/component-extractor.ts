/**
 * S.C.O.P.E. Component Extractor
 *
 * Uses Anthropic Claude to analyze coaching conversations and extract
 * S.C.O.P.E. framework components from natural dialogue.
 *
 * Components:
 * - S: Situation - Past events and context
 * - C: Choices - Options and alternatives considered
 * - O: Outcomes - Expected results and consequences
 * - P: Purpose - Values and deeper motivations
 * - E: Engagement - Commitment and action plans
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================================================
// INTERFACES
// ============================================================================

export interface Message {
  role: 'coach' | 'client';
  content: string;
  timestamp?: string;
  turnNumber?: number;
}

export interface QualityScore {
  criterion: string;
  score: number; // 0-1 scale
  feedback: string;
}

export interface ComponentExtraction {
  extracted: boolean;
  confidence: number; // 0-1 scale
  content: string;
  evidence: string[]; // Quotes from transcript
  qualityScores: QualityScore[];
  overallQuality: number; // 0-1 scale, average of qualityScores
}

export interface ExtractionResult {
  components: {
    situation: ComponentExtraction;
    choices: ComponentExtraction;
    outcomes: ComponentExtraction;
    purpose: ComponentExtraction;
    engagement: ComponentExtraction;
  };
  completeness: number; // 0-100 percentage
  contradictions: ContradictionItem[];
  missingComponents: string[];
  nextProbe: string;
  metadata: {
    model: string;
    timestamp: string;
    turnCount: number;
    processingTimeMs: number;
  };
}

export interface ContradictionItem {
  component: string;
  statement1: string;
  statement2: string;
  severity: 'low' | 'medium' | 'high';
  suggestedResolution: string;
}

// ============================================================================
// EXTRACTION PROMPT
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are an expert coaching analyst specializing in the S.C.O.P.E. framework for developmental conversations. Your task is to analyze coaching transcripts and extract the five core components with detailed quality assessment.

## S.C.O.P.E. FRAMEWORK COMPONENTS

### S - SITUATION
The concrete, specific past event or context being discussed.
Quality Criteria:
- Uses past tense (was, did, happened)
- Contains specific time/place markers (yesterday, at the meeting, last week)
- Is concrete rather than abstract
- Relates to a real, observable event

### C - CHOICES
The options, alternatives, and decisions available or considered.
Quality Criteria:
- Contains action verbs (could, might, decided to)
- Shows multiple options considered
- Demonstrates awareness of alternatives
- Includes attitude words showing consideration (thought about, considered)

### O - OUTCOMES
The expected results, consequences, and impacts of choices.
Quality Criteria:
- Distinguishes proximal (immediate) from distal (long-term) outcomes
- Includes both visible and internal outcomes
- Shows clear causality between actions and results
- Balances punitive and capability-building perspectives

### P - PURPOSE
The deeper values, meaning, and motivation behind the situation.
Quality Criteria:
- Connects to personal values
- Links to broader goals
- Avoids coercive framing
- Inspires rather than controls
- Is developmental rather than disciplinary

### E - ENGAGEMENT
The commitment to action, accountability, and follow-through.
Quality Criteria:
- Contains open questions (not yes/no)
- Invites genuine response (not compliance)
- Is collaborative rather than directive
- Shows shared responsibility for outcomes

## OUTPUT FORMAT

Respond with a JSON object containing:
{
  "components": {
    "situation": {
      "extracted": boolean,
      "confidence": number (0-1),
      "content": "Extracted content summary",
      "evidence": ["Quote 1", "Quote 2"],
      "qualityScores": [
        {"criterion": "past_tense", "score": 0-1, "feedback": "..."},
        {"criterion": "time_place_markers", "score": 0-1, "feedback": "..."},
        {"criterion": "concreteness", "score": 0-1, "feedback": "..."},
        {"criterion": "relatability", "score": 0-1, "feedback": "..."}
      ],
      "overallQuality": number (0-1)
    },
    "choices": { ... },
    "outcomes": { ... },
    "purpose": { ... },
    "engagement": { ... }
  },
  "completeness": number (0-100),
  "contradictions": [
    {
      "component": "situation",
      "statement1": "Earlier quote",
      "statement2": "Later contradicting quote",
      "severity": "low|medium|high",
      "suggestedResolution": "Probe to clarify..."
    }
  ],
  "missingComponents": ["component names that weren't found or are incomplete"],
  "nextProbe": "Suggested question to fill the most critical gap"
}

## ANALYSIS GUIDELINES

1. Be precise about confidence levels:
   - 0.0-0.3: Component barely mentioned or very unclear
   - 0.3-0.6: Component present but incomplete or vague
   - 0.6-0.8: Component well-articulated with some gaps
   - 0.8-1.0: Component fully developed with clear evidence

2. Extract direct quotes as evidence (keep them brief but complete)

3. For quality scores, be specific in feedback about what's present and what's missing

4. Identify contradictions that could undermine coaching effectiveness

5. Suggest the single most impactful probe question to advance the conversation

6. Calculate completeness as the weighted average of extraction confidence across all components`;

// ============================================================================
// SCOPE COMPONENT EXTRACTOR CLASS
// ============================================================================

export class ScopeComponentExtractor {
  private client: Anthropic;
  private model: string = 'claude-sonnet-4-5-20250929';

  constructor(apiKey: string) {
    this.client = new Anthropic({
      apiKey: apiKey,
    });
  }

  /**
   * Formats an array of messages into a readable transcript
   */
  private formatTranscript(messages: Message[]): string {
    return messages.map((msg, idx) => {
      const timestamp = msg.timestamp || '';
      const turnNum = msg.turnNumber ?? idx + 1;
      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      const timeStr = timestamp ? ` [${timestamp}]` : '';
      return `Turn ${turnNum}${timeStr} - ${role}:\n${msg.content}`;
    }).join('\n\n');
  }

  /**
   * Extracts S.C.O.P.E. components from a coaching conversation
   */
  async extractComponents(messages: Message[]): Promise<ExtractionResult> {
    const startTime = Date.now();

    if (messages.length === 0) {
      return this.createEmptyResult(startTime);
    }

    const transcript = this.formatTranscript(messages);

    const userPrompt = `Analyze the following coaching conversation transcript and extract the S.C.O.P.E. components.

## TRANSCRIPT

${transcript}

## INSTRUCTIONS

1. Identify each S.C.O.P.E. component present in the conversation
2. Extract specific evidence (quotes) for each component
3. Score the quality of each component against its criteria
4. Identify any contradictions in the client's statements
5. Determine what's missing and suggest the best next probe

Respond only with the JSON object as specified in your system instructions.`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const processingTimeMs = Date.now() - startTime;

      // Extract text content from response
      const textContent = response.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in response');
      }

      // Parse JSON from response
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize the result
      const result = this.normalizeResult(parsed);

      // Add metadata
      result.metadata = {
        model: this.model,
        timestamp: new Date().toISOString(),
        turnCount: messages.length,
        processingTimeMs,
      };

      return result;
    } catch (error) {
      console.error('Error extracting components:', error);
      throw error;
    }
  }

  /**
   * Creates an empty result for when no messages are provided
   */
  private createEmptyResult(startTime: number): ExtractionResult {
    const emptyComponent: ComponentExtraction = {
      extracted: false,
      confidence: 0,
      content: '',
      evidence: [],
      qualityScores: [],
      overallQuality: 0,
    };

    return {
      components: {
        situation: { ...emptyComponent },
        choices: { ...emptyComponent },
        outcomes: { ...emptyComponent },
        purpose: { ...emptyComponent },
        engagement: { ...emptyComponent },
      },
      completeness: 0,
      contradictions: [],
      missingComponents: ['situation', 'choices', 'outcomes', 'purpose', 'engagement'],
      nextProbe: 'Please describe a recent situation where you faced a challenge or decision.',
      metadata: {
        model: this.model,
        timestamp: new Date().toISOString(),
        turnCount: 0,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Normalizes and validates the parsed result
   */
  private normalizeResult(parsed: any): ExtractionResult {
    const componentNames = ['situation', 'choices', 'outcomes', 'purpose', 'engagement'] as const;

    // Ensure components object exists
    if (!parsed.components) {
      parsed.components = {};
    }

    // Normalize each component
    for (const name of componentNames) {
      if (!parsed.components[name]) {
        parsed.components[name] = {
          extracted: false,
          confidence: 0,
          content: '',
          evidence: [],
          qualityScores: [],
          overallQuality: 0,
        };
      } else {
        const comp = parsed.components[name];

        // Ensure all required fields exist
        comp.extracted = Boolean(comp.extracted);
        comp.confidence = this.clamp(comp.confidence || 0, 0, 1);
        comp.content = comp.content || '';
        comp.evidence = Array.isArray(comp.evidence) ? comp.evidence : [];
        comp.qualityScores = Array.isArray(comp.qualityScores)
          ? comp.qualityScores.map((qs: any) => ({
              criterion: qs.criterion || 'unknown',
              score: this.clamp(qs.score || 0, 0, 1),
              feedback: qs.feedback || '',
            }))
          : [];

        // Calculate overall quality if not provided
        if (comp.qualityScores.length > 0) {
          const avgScore = comp.qualityScores.reduce(
            (sum: number, qs: QualityScore) => sum + qs.score,
            0
          ) / comp.qualityScores.length;
          comp.overallQuality = this.clamp(avgScore, 0, 1);
        } else {
          comp.overallQuality = comp.confidence;
        }
      }
    }

    // Normalize other fields
    const result: ExtractionResult = {
      components: parsed.components,
      completeness: this.clamp(parsed.completeness || 0, 0, 100),
      contradictions: Array.isArray(parsed.contradictions)
        ? parsed.contradictions.map((c: any) => ({
            component: c.component || 'unknown',
            statement1: c.statement1 || '',
            statement2: c.statement2 || '',
            severity: ['low', 'medium', 'high'].includes(c.severity) ? c.severity : 'medium',
            suggestedResolution: c.suggestedResolution || '',
          }))
        : [],
      missingComponents: Array.isArray(parsed.missingComponents)
        ? parsed.missingComponents
        : [],
      nextProbe: parsed.nextProbe || 'Tell me more about what happened.',
      metadata: parsed.metadata || {
        model: this.model,
        timestamp: new Date().toISOString(),
        turnCount: 0,
        processingTimeMs: 0,
      },
    };

    return result;
  }

  /**
   * Clamps a value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Sets the model to use for extraction
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Gets the current model being used
   */
  getModel(): string {
    return this.model;
  }
}

export default ScopeComponentExtractor;
