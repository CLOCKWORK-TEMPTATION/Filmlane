import { LineCandidate } from "./types";

/**
 * Determines if a pasted block requires AI review based on "Hard" (logic violations)
 * and "Soft" (low confidence) triggers.
 */
export function shouldReviewPastedBlock(lines: LineCandidate[]): boolean {
    // 1. Hard Trigger: Inline character pattern (Colon inside ACTION)
    // Example: "HAMID: Hello there" misclassified as ACTION
    const inlineLikely = lines.some(
        (l) => l.type === "ACTION" && l.text.includes(":") && l.text.length < 100 // colon in short action is suspicious
    );
    if (inlineLikely) return true;

    // 2. Hard Trigger: DIALOGUE without CHARACTER preceding it
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].type === "DIALOGUE") {
            // Check immediate predecessor in the pasted block
            // Note: This is a local check. If the character was in the *context* (before paste),
            // we might false positive here, but it's safer to review.
            if (i === 0 || lines[i - 1].type !== "CHARACTER" && lines[i - 1].type !== "PARENTHETICAL") {
                return true;
            }
        }
    }

    // 3. Hard Trigger: Broken Scene Header Sequence
    // E.g., Header 3 without 1/2, or Header 2 without 1? 
    // (Simplified for now: if we see random header levels that look odd, but currently our classifier barely detects headers well enough to trust this rule rigidly. keeping disabled or simple.)

    // 4. Soft Trigger: Low Confidence Scores
    let softCount = 0;
    for (const l of lines) {
        if (typeof l.topScore === "number" && typeof l.secondScore === "number") {
            const margin = l.topScore - l.secondScore;
            // Confidence Thresholds
            if (l.topScore < 0.55 || margin < 0.10) {
                softCount++;
            }
        }
    }

    // Require at least 2 soft signals to trigger review to avoid noise
    if (softCount >= 2) return true;

    return false;
}
