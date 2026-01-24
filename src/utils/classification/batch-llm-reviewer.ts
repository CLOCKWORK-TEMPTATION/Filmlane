import type { AIPayload, AIPatchOp } from '../ai-reviewer';
import { reviewContent } from '../screenplay-service';

type BatchReviewRequest = {
  lines: { id: string; text: string; type: string; score: number }[];
  threshold: number;
};

type BatchReviewResult = {
  reviewed: number;
  skipped: number;
  patches: AIPatchOp[];
};

export class BatchLLMReviewer {
  private readonly DEFAULT_THRESHOLD = 5.0;

  async reviewBatch(request: BatchReviewRequest): Promise<BatchReviewResult> {
    const threshold = request.threshold ?? this.DEFAULT_THRESHOLD;
    const uncertainLines = request.lines.filter((line) => line.score < threshold);
    const skippedCount = request.lines.length - uncertainLines.length;

    if (uncertainLines.length === 0) {
      return {
        reviewed: 0,
        skipped: skippedCount,
        patches: [],
      };
    }

    const payload: AIPayload = {
      before_context: [],
      pasted_block: uncertainLines,
      rules: {
        character_requires_colon: true,
        dialogue_must_follow_character: true,
      },
      stats: {
        total_lines: request.lines.length,
        triggered_lines: uncertainLines.length,
        reasons: { low_confidence: uncertainLines.length },
      },
    };

    const patches = await reviewContent(payload);

    return {
      reviewed: uncertainLines.length,
      skipped: skippedCount,
      patches,
    };
  }
}

export const batchLLMReviewer = new BatchLLMReviewer();
