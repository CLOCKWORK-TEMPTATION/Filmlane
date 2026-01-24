import type { LineContext } from '@/types/screenplay';
import {
  ACTION_VERB_LIST,
  EXTRA_ACTION_VERBS,
  STOP_WORDS,
  STAGE_DIRECTION_PREFIXES,
  CONVERSATIONAL_STARTS,
  IMPERATIVE_VERBS,
  ACTION_START_PATTERNS,
} from './constants';

export type ConfidenceScore = {
  score: number;
  sources: string[];
  metadata: {
    ruleMatches: Record<string, boolean>;
    weightedSum: number;
  };
};

type RuleMatches = Record<string, boolean>;

type ConfidenceResult = {
  score: number;
  sources: string[];
  matches: RuleMatches;
};

const clampScore = (score: number): number => {
  return Math.max(0, Math.min(10, score));
};

const buildResult = (result: ConfidenceResult): ConfidenceScore => {
  const finalScore = clampScore(result.score);
  return {
    score: finalScore,
    sources: result.sources,
    metadata: {
      ruleMatches: result.matches,
      weightedSum: result.score,
    },
  };
};

const normalizeLine = (input: string): string => {
  return input
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200f\u200e\ufeff\t]+/g, '')
    .trim();
};

const SCENE_NUMBER_RE = /(?:مشهد|scene)\s*([0-9٠-٩]+)/i;
const TIME_RE = /(نهار|ليل|صباح|مساء|فجر)/i;
const LOCATION_RE = /(داخلي|خارجي)/i;
const TIME_TOKEN_RE = /(?:^|[\s،؛\-–—])(?:نهار|ليل|صباح|مساء|فجر)(?:$|[\s،؛\-–—])/i;
const LOCATION_LINE_START_RE = /^(?:داخلي|خارجي)[.:]?(?:\s|$)/i;
const TRANSITION_RE = /^(قطع|اختفاء|تحول|انتقال|fade|cut|dissolve|wipe)/i;
const CHARACTER_RE = /^\s*(?:صوت\s+)?[\u0600-\u06FF][\u0600-\u06FF\s0-9٠-٩]{0,30}:?\s*$/;

const ACTION_VERB_HINTS = new Set([
  'يبدو',
  'تبدو',
  'تتنهد',
  'يتنهد',
  'يصمت',
  'تصمت',
  'يتحدث',
  'تتحدث',
  'يهمس',
  'تهمس',
]);

// Combine all action verbs for checking
const ALL_ACTION_VERBS = new Set(
  (ACTION_VERB_LIST + '|' + EXTRA_ACTION_VERBS)
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean),
);

const isActionStart = (line: string): boolean => {
  const normalized = normalizeLine(line);

  if (ACTION_START_PATTERNS.some((pattern) => pattern.test(normalized))) return true;

  const firstToken = normalized.split(/\s+/)[0] ?? '';
  if (!firstToken) return false;

  if (ALL_ACTION_VERBS.has(firstToken)) return true;

  // Check leading particles
  const leadingParticles = ['و', 'ف', 'ل'];
  for (const p of leadingParticles) {
    if (firstToken.startsWith(p) && firstToken.length > 1) {
      const candidate = firstToken.slice(1);
      if (ALL_ACTION_VERBS.has(candidate)) return true;
    }
  }

  return false;
};

export class ConfidenceScorer {
  private readonly weights = {
    exactPattern: 3.0,
    contextPattern: 2.0,
    linguisticPattern: 1.0,
    contextBoost: 1.5,
    memoryBoost: 2.0,
  };

  calculateSceneHeaderConfidence(line: string, ctx: LineContext): ConfidenceScore {
    const sources: string[] = [];
    const matches: RuleMatches = {};
    let score = 0;

    const normalized = normalizeLine(line).replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;

    if (SCENE_NUMBER_RE.test(normalized)) {
      score += this.weights.exactPattern;
      sources.push('scene_number');
      matches.sceneNumber = true;
    }

    if (LOCATION_LINE_START_RE.test(normalized)) {
      score += this.weights.contextPattern;
      sources.push('location_start');
      matches.locationStart = true;
    }

    if (TIME_TOKEN_RE.test(normalized)) {
      score += this.weights.contextPattern;
      sources.push('time_token');
      matches.timeToken = true;
    }

    if (TIME_RE.test(normalized) || LOCATION_RE.test(normalized)) {
      score += this.weights.linguisticPattern;
      sources.push('scene_keywords');
      matches.sceneKeywords = true;
    }

    if (ctx.pattern.isInSceneHeader) {
      score += this.weights.contextBoost;
      sources.push('scene_context');
      matches.sceneContext = true;
    }

    if (wordCount > 12 || normalized.length > 120) {
      score -= this.weights.contextPattern;
      sources.push('too_long');
      matches.tooLong = true;
    }

    return buildResult({ score, sources, matches });
  }

  calculateCharacterConfidence(line: string, ctx: LineContext): ConfidenceScore {
    const sources: string[] = [];
    const matches: RuleMatches = {};
    let score = 0;

    const trimmed = line.trim();
    const normalized = normalizeLine(trimmed);
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const wordCount = tokens.length;
    const hasColon = trimmed.includes(':') || trimmed.includes('：');
    const hasStopWord = tokens.some((t) => STOP_WORDS.has(t));
    const firstToken = tokens[0] ?? '';
    const isStageDirection = STAGE_DIRECTION_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix),
    );
    const isActionLike = isActionStart(line) || ACTION_VERB_HINTS.has(firstToken);

    // Check if name is actually an imperative verb (common issue: "ادخل:" -> should be dialogue/action)
    const namePart = hasColon ? normalized.split(/[:：]/)[0].trim() : normalized;
    const isImperativeName = IMPERATIVE_VERBS.has(namePart);

    if (isImperativeName) {
      score -= 5;
      sources.push('imperative_verb_name');
      matches.imperativeVerbName = true;
    }

    if (hasColon && (trimmed.endsWith(':') || trimmed.endsWith('：'))) {
      score += this.weights.exactPattern;
      sources.push('ends_with_colon');
      matches.endsWithColon = true;
    }

    if (CHARACTER_RE.test(trimmed)) {
      score += this.weights.exactPattern;
      sources.push('character_regex');
      matches.characterRegex = true;
    }

    if (wordCount > 0 && wordCount <= 4) {
      score += this.weights.linguisticPattern;
      sources.push('short_name');
      matches.shortName = true;
    }

    if (!hasStopWord) {
      score += this.weights.linguisticPattern;
      sources.push('no_stop_words');
      matches.noStopWords = true;
    }

    if (isStageDirection || (hasColon && isActionLike && (wordCount >= 3 || hasStopWord))) {
      score -= this.weights.exactPattern;
      score -= this.weights.contextPattern;
      sources.push('action_like_penalty');
      matches.actionLikePenalty = true;
    }

    const lastType = ctx.previousTypes.slice(-1)[0];
    if (lastType === 'action') {
      score += this.weights.contextBoost;
      sources.push('after_action');
      matches.afterAction = true;
    }

    if (ctx.pattern.isInDialogueBlock) {
      score += this.weights.contextPattern;
      sources.push('dialogue_block');
      matches.dialogueBlock = true;
    }

    if (/[^:：][؟!?"«»]/.test(trimmed)) {
      score -= this.weights.linguisticPattern;
      sources.push('punctuation_penalty');
      matches.punctuationPenalty = true;
    }

    return buildResult({ score, sources, matches });
  }

  calculateDialogueConfidence(line: string, ctx: LineContext): ConfidenceScore {
    const sources: string[] = [];
    const matches: RuleMatches = {};
    let score = 0;

    const normalized = normalizeLine(line);
    const wordCount = normalized.split(/\s+/).filter(Boolean).length;
    const lastType = ctx.previousTypes.slice(-1)[0];

    // 1. Punctuation Indicators
    if (/[؟?]/.test(line)) {
      score += 3;
      sources.push('question_mark');
      matches.questionMark = true;
    }
    if (/!/.test(line)) {
      score += 1;
      sources.push('exclamation');
      matches.exclamation = true;
    }
    if (/\.\./.test(line)) {
      score += 1;
      sources.push('ellipses');
      matches.ellipses = true;
    }

    // 2. Vocative Particles
    if (/\bيا\s+[\u0600-\u06FF]+/.test(normalized)) {
      score += 4;
      sources.push('vocative_particle');
      matches.vocativeParticle = true;
    }
    if (
      /يا\s*([أا]خي|[أا]ختي|[يأ]سطى|باشا|بيه|هانم|مدام|أستاذ|ياعم|ياواد|يابنت)/.test(normalized)
    ) {
      score += 2;
      sources.push('common_vocative');
      matches.commonVocative = true;
    }

    // 3. Conversational Starts
    const firstWord = normalized.split(' ')[0];
    if (CONVERSATIONAL_STARTS.includes(firstWord)) {
      score += 2;
      sources.push('conversational_start');
      matches.conversationalStart = true;
    }

    // Deeper conversational markers
    if (/\b(ده|دي|كده|عشان|علشان|عايز|عايزة|مش|هو|هي|احنا)\b/.test(normalized)) {
      score += 1;
      sources.push('conversational_marker');
      matches.conversationalMarker = true;
    }

    // 4. Quotation Marks
    if (/["«»]/.test(line)) {
      score += this.weights.linguisticPattern;
      sources.push('quotes');
      matches.quotes = true;
    }

    // 5. Context
    if (lastType === 'character' || lastType === 'parenthetical') {
      score += this.weights.exactPattern;
      sources.push('after_character');
      matches.afterCharacter = true;
    }

    if (ctx.pattern.isInDialogueBlock) {
      score += this.weights.contextBoost;
      sources.push('dialogue_context');
      matches.dialogueContext = true;
    }

    // Special Rule: If previous was dialogue, and this line is NOT a scene header/character,
    // it's very likely continued dialogue.
    if (lastType === 'dialogue') {
      // Check it's not a character or scene header (handled by other scorers, but we boost dialogue here)
      // We assume other scorers will output high confidence for their types.
      // But we boost dialogue here to win over "Action" if ambiguous.
      score += 2;
      sources.push('continued_dialogue');
      matches.continuedDialogue = true;
    }

    if (wordCount >= 3 && wordCount <= 30) {
      score += this.weights.linguisticPattern;
      sources.push('dialogue_length');
      matches.dialogueLength = true;
    }

    // Penalties
    if (isActionStart(line)) {
      // Only penalize if we don't have strong dialogue indicators
      if (score < 4) {
        score -= 3;
        sources.push('action_start_penalty');
        matches.actionStartPenalty = true;
      }
    }

    return buildResult({ score, sources, matches });
  }

  calculateActionConfidence(line: string, ctx: LineContext): ConfidenceScore {
    const sources: string[] = [];
    const matches: RuleMatches = {};
    let score = 0;
    const normalized = normalizeLine(line);
    const isStageDirection = STAGE_DIRECTION_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix),
    );

    if (isActionStart(line)) {
      score += this.weights.exactPattern;
      sources.push('action_start');
      matches.actionStart = true;
    }

    if (isStageDirection) {
      score += this.weights.linguisticPattern;
      sources.push('stage_direction');
      matches.stageDirection = true;
    }

    if (ctx.stats.isLong && ctx.stats.hasPunctuation) {
      score += this.weights.contextPattern;
      sources.push('long_with_punctuation');
      matches.longWithPunctuation = true;
    }

    if (!ctx.pattern.isInDialogueBlock) {
      score += this.weights.contextBoost;
      sources.push('not_in_dialogue');
      matches.notInDialogue = true;
    }

    if (ctx.stats.startsWithBullet) {
      score += this.weights.linguisticPattern;
      sources.push('bullet_start');
      matches.bulletStart = true;
    }

    return buildResult({ score, sources, matches });
  }

  calculateTransitionConfidence(line: string): ConfidenceScore {
    const sources: string[] = [];
    const matches: RuleMatches = {};
    let score = 0;

    if (TRANSITION_RE.test(normalizeLine(line))) {
      score = 10;
      sources.push('transition_keyword');
      matches.transitionKeyword = true;
    }

    return buildResult({ score, sources, matches });
  }
}

export const confidenceScorer = new ConfidenceScorer();
