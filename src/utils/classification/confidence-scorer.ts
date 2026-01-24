import type { LineContext } from '@/types/screenplay';

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

const STOP_WORDS = new Set([
  'في',
  'على',
  'من',
  'إلى',
  'داخل',
  'خارج',
  'أمام',
  'خلف',
  'تحت',
  'فوق',
  'بين',
  'حول',
  'ثم',
  'بعد',
  'قبل',
  'عندما',
  'بينما',
  'مع',
  'فجأة',
  'وهو',
  'وهي',
  'ولكن',
  'حتى',
]);

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

const STAGE_DIRECTION_PREFIXES = [
  'بهدوء',
  'بصمت',
  'بغضب',
  'بحزن',
  'بابتسامة',
  'بقلق',
  'بدهشة',
  'بتردد',
  'بخجل',
  'بصوت',
  'بنبرة',
];

const ACTION_START_PATTERNS = [
  /^\s*(?:ثم\s+)?(?:و(?:هو|هي)\s+)?[يت][\u0600-\u06FF]{2,}(?:\s+\S|$)/,
  /^\s*(?:و|ف|ل)?(?:نرى|نسمع|نلاحظ|نقترب|نبتعد|ننتقل)(?:\s+\S|$)/,
  /^\s*(?:رأينا|سمعنا|لاحظنا|شاهدنا)(?:\s+\S|$)/,
  /^\s*(?:ادخل|اخرج|انظر|استمع|اقترب|ابتعد|توقف)(?:\s+\S|$)/,
];

const isActionStart = (line: string): boolean => {
  const normalized = normalizeLine(line);
  return ACTION_START_PATTERNS.some((pattern) => pattern.test(normalized));
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

    if (/[؟?]/.test(line)) {
      score += 3;
      sources.push('question_mark');
      matches.questionMark = true;
    }

    if (/\bيا\s+[\u0600-\u06FF]+/.test(normalized)) {
      score += 4;
      sources.push('vocative_particle');
      matches.vocativeParticle = true;
    }

    if (/["«»]/.test(line)) {
      score += this.weights.linguisticPattern;
      sources.push('quotes');
      matches.quotes = true;
    }

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

    if (wordCount >= 3 && wordCount <= 30) {
      score += this.weights.linguisticPattern;
      sources.push('dialogue_length');
      matches.dialogueLength = true;
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
