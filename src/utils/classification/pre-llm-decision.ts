import type { LineContext } from '@/types/screenplay';
import type { ConfidenceScore } from './confidence-scorer';

export type PreLLMDecision = {
  shouldUseLLM: boolean;
  confidence: number;
  reason: string;
  fallbackClassification?: string;
};

export class PreLLMDecisionEngine {
  private readonly HIGH_CONFIDENCE_THRESHOLD = 7.5;
  private readonly MEDIUM_CONFIDENCE_THRESHOLD = 5.0;
  private readonly LOW_CONFIDENCE_THRESHOLD = 3.0;

  decide(line: string, scores: Record<string, ConfidenceScore>, ctx: LineContext): PreLLMDecision {
    void line;
    const entries = Object.entries(scores);
    const maxScore = Math.max(...entries.map(([, s]) => s.score));
    const topType = entries.find(([, s]) => s.score === maxScore)?.[0];

    if (maxScore >= this.HIGH_CONFIDENCE_THRESHOLD) {
      return {
        shouldUseLLM: false,
        confidence: maxScore,
        reason: 'high_confidence_rule_match',
        fallbackClassification: topType,
      };
    }

    if (maxScore >= this.MEDIUM_CONFIDENCE_THRESHOLD && this.hasStrongContext(ctx)) {
      return {
        shouldUseLLM: false,
        confidence: maxScore,
        reason: 'medium_confidence_strong_context',
        fallbackClassification: topType,
      };
    }

    if (maxScore < this.LOW_CONFIDENCE_THRESHOLD) {
      return {
        shouldUseLLM: true,
        confidence: maxScore,
        reason: `low_confidence_all_rules`,
      };
    }

    const ambiguousTypes = entries
      .filter(([, s]) => s.score >= maxScore - 1.5)
      .map(([type]) => type);

    if (ambiguousTypes.length >= 2) {
      return {
        shouldUseLLM: true,
        confidence: maxScore,
        reason: `ambiguous_between_${ambiguousTypes.length}_types`,
      };
    }

    return {
      shouldUseLLM: true,
      confidence: maxScore,
      reason: 'medium_confidence_default_llm',
    };
  }

  private hasStrongContext(ctx: LineContext): boolean {
    return (
      ctx.pattern.isInDialogueBlock ||
      ctx.pattern.lastCharacterDistance <= 2 ||
      ctx.pattern.isInSceneHeader
    );
  }
}

export const preLLMDecisionEngine = new PreLLMDecisionEngine();
