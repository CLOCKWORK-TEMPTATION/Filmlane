import { LineContext } from '@/types/screenplay';

export interface AIPatchOp {
    op: 'relabel' | 'split_inline';
    index: number; // 0-based index within the pasted block
    id?: string; // Unique ID of the line to patch (preferred over index)
    from?: string;
    to?: string;
    delimiter?: string;
    leftType?: string;
    rightType?: string;
}

export interface AIReviewResponse {
    patches: AIPatchOp[];
}

export interface AIPayload {
    before_context: { text: string; type: string }[];
    pasted_block: { id?: string; text: string; type: string; score?: number }[];
    rules: {
        character_requires_colon: boolean;
        dialogue_must_follow_character: boolean;
    };
    stats?: { // New reporting stats
        total_lines: number;
        triggered_lines: number;
        reasons: Record<string, number>; // e.g., "Colon in Action": 5
    };
}

export type ReviewTriggerResult = {
    trigger: boolean;
    reason?: string;
    score?: number;
};

/**
 * "Method of Doubt": Determines if we should bother calling the AI.
 */
export const shouldTriggerReview = (
    line: string,
    currentType: string,
    score: number,
    ctx: LineContext
): ReviewTriggerResult => {
    // 1. Colon in Action with low/medium score
    if (currentType === 'action' && (line.includes(':') || line.includes('：'))) {
        if (score < 4) return { trigger: true, reason: 'Colon in Action', score };
    }

    // 2. Broken Sequence: Dialogue-like text but NOT following Character
    // REFINED: Only trigger if it strongly looks like dialogue linguistically
    if (currentType === 'action' && score >= 3) {
        const lastType = ctx.previousTypes[ctx.previousTypes.length - 1];
        if (lastType !== 'character' && lastType !== 'parenthetical') {
            // Linguistic Checks for Dialogue:
            const hasQuotes = /["'«»]/.test(line);
            const hasFirstPerson = /(?:^|\s)(أنا|إحنا|يا|ياعم|يابني|ياحبيبي|بقولك|طب|يا|أنت|إنت)(?:\s|$)/.test(line);
            const isShortAndPunchy = line.split(/\s+/).length < 8 && /[!؟?]/.test(line);
            const looksLikeDialogue = hasQuotes || hasFirstPerson || isShortAndPunchy;

            if (looksLikeDialogue) {
                return { trigger: true, reason: 'Action High Score No Character (Linguistic)', score };
            }
        }
    }

    // 3. Dialogue line too long? (Potential formatting error)
    if (currentType === 'dialogue' && ctx.stats.wordCount > 30) {
        return { trigger: true, reason: 'Long Dialogue', score };
    }

    return { trigger: false };
};

export const constructAIRequestPayload = (
    processedBlock: { id: string; text: string; type: string; score: number }[],
    beforeContext: { text: string; type: string }[],
    stats?: AIPayload['stats']
): AIPayload => {
    return {
        before_context: beforeContext,
        pasted_block: processedBlock.map(item => ({
            id: item.id,
            text: item.text,
            type: item.type,
            score: item.score
        })),
        rules: {
            character_requires_colon: true,
            dialogue_must_follow_character: true
        },
        stats
    };
};
