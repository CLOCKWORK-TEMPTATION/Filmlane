import React from 'react';
import { logger } from './logger';
import {
  PersistentMemoryManager,
  persistentMemoryManager as defaultMemoryManager,
  type PersistentMemory,
} from './classification/persistent-memory';
import type { LineContext } from '@/types/screenplay';
import { confidenceScorer, type ConfidenceScore } from './classification/confidence-scorer';
import { preLLMDecisionEngine, type PreLLMDecision } from './classification/pre-llm-decision';
import { getContextAnalysis } from './classification/server-actions';

/**
 * =========================
 *  Utilities
 * =========================
 */

const cssObjectToString = (styles: React.CSSProperties): string => {
  return Object.entries(styles)
    .map(([key, value]) => {
      const cssKey = key.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
      return `${cssKey}: ${String(value)}`;
    })
    .join('; ');
};

/**
 * =========================
 *  Spacing Rules (قواعد التباعد بين العناصر)
 * =========================
 *
 * القواعد:
 * - basmala → أي عنصر: لا سطر فارغ
 * - scene-header-2 → scene-header-3: سطر فارغ
 * - scene-header-3 → action: سطر فارغ
 * - action → action/character/transition: سطر فارغ
 * - character → dialogue/parenthetical: لا سطر فارغ (ممنوع!)
 * - dialogue → character/action/transition: سطر فارغ
 * - parenthetical → يتبع نفس قواعد dialogue
 * - transition → scene-header-1/scene-header-top-line: سطر فارغ
 */
import { shouldTriggerReview, constructAIRequestPayload, type AIPayload } from './ai-reviewer';

const getSpacingMarginTop = (previousFormat: string, currentFormat: string): string => {
  if (previousFormat === 'basmala') {
    return '0';
  }

  if (previousFormat === 'character') {
    if (currentFormat === 'dialogue' || currentFormat === 'parenthetical') {
      return '0';
    }
  }

  if (previousFormat === 'parenthetical' && currentFormat === 'dialogue') {
    return '0';
  }

  if (previousFormat === 'scene-header-2' && currentFormat === 'scene-header-3') {
    return '0';
  }

  if (previousFormat === 'scene-header-3' && currentFormat === 'action') {
    return '12pt';
  }

  if (previousFormat === 'action') {
    if (
      currentFormat === 'action' ||
      currentFormat === 'character' ||
      currentFormat === 'transition'
    ) {
      return '12pt';
    }
  }

  if (previousFormat === 'dialogue') {
    if (
      currentFormat === 'character' ||
      currentFormat === 'action' ||
      currentFormat === 'transition'
    ) {
      return '12pt';
    }
  }

  if (previousFormat === 'parenthetical') {
    if (
      currentFormat === 'character' ||
      currentFormat === 'action' ||
      currentFormat === 'transition'
    ) {
      return '0';
    }
  }

  if (previousFormat === 'transition') {
    if (currentFormat === 'scene-header-1' || currentFormat === 'scene-header-top-line') {
      return '12pt';
    }
  }

  return '';
};

const buildLineDivHTML = (
  className: string,
  styles: React.CSSProperties,
  text: string,
  marginTop?: string,
  id?: string,
  confidence?: number,
): string => {
  const div = document.createElement('div');
  div.className = className;
  if (id) {
    div.id = id;
  }
  if (typeof confidence === 'number') {
    div.dataset.confidence = String(confidence);
  }

  const finalStyles = { ...styles };
  if (marginTop) {
    finalStyles.marginTop = marginTop;
  }

  div.setAttribute('style', cssObjectToString(finalStyles));
  div.textContent = text;
  return div.outerHTML;
};

const stripLeadingBullets = (input: string): string => {
  return input.replace(/^[\s\u200E\u200F\u061C\ufeFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+\-]+\s*/, '');
};

const normalizeLine = (input: string): string => {
  return input
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u200f\u200e\ufeff\t]+/g, '')
    .replace(/^[\s\u200E\u200F\u061C\ufeFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+\-]+/, '')
    .trim();
};

const hasSentencePunctuation = (line: string): boolean => {
  return /[.!?،؛]/.test(line);
};

/**
 * =========================
 *  Basmala
 * =========================
 */

const isBasmala = (line: string): boolean => {
  const cleaned = line
    .replace(/[{}()\[\]]/g, '')
    .replace(/[\u200f\u200e\ufeff]/g, '')
    .trim();
  const normalized = normalizeLine(cleaned);

  const compact = normalized.replace(/[^\u0600-\u06FF\s]/g, '');
  const hasBasm = /بسم/i.test(compact);
  const hasAllah = /الله/i.test(compact);
  const hasRahman = /الرحمن/i.test(compact) || /الرحي/i.test(compact);

  return hasBasm && hasAllah && hasRahman;
};

/**
 * =========================
 *  Scene Header Logic
 * =========================
 */

const SCENE_NUMBER_RE = /(?:مشهد|scene)\s*([0-9٠-٩]+)/i;
const SCENE_NUMBER_EXACT_RE = /^\s*(?:مشهد|scene)\s*[0-9٠-٩]+/i;

const isSceneHeader1 = (line: string): boolean => {
  const normalized = normalizeLine(line);
  return SCENE_NUMBER_RE.test(normalized);
};

const TIME_RE = /(نهار|ليل|صباح|مساء|فجر)/i;
const LOCATION_RE = /(داخلي|خارجي)/i;
const TIME_TOKEN_RE = /(?:^|[\s،؛\-–—])(?:نهار|ليل|صباح|مساء|فجر)(?:$|[\s،؛\-–—])/i;
const LOCATION_LINE_START_RE = /^(?:داخلي|خارجي)[.:]?(?:\s|$)/i;

const isSceneHeader2 = (line: string): boolean => {
  const normalized = normalizeLine(line).replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  // Guardrails: prevent classifying long descriptive paragraphs as scene headers
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount > 12) return false;
  if (normalized.length > 120) return false;

  // Scene header 2 should start with داخل/خارج (or their variants) and include a time token.
  const hasLocationAtStart = LOCATION_LINE_START_RE.test(normalized);
  const hasTimeToken = TIME_TOKEN_RE.test(normalized);
  return hasLocationAtStart && hasTimeToken;
};

const isCompleteSceneHeader = (line: string): boolean => {
  const normalized = normalizeLine(line);
  return SCENE_NUMBER_EXACT_RE.test(normalized) && isSceneHeader2(normalized);
};

const splitSceneHeader = (line: string): { number: string; description: string } | null => {
  const match = line.match(/^\s*((?:مشهد|scene)\s*[0-9٠-٩]+)\s*[-–—:،]?\s*(.*)/i);
  if (!match) return null;
  return {
    number: match[1].trim(),
    description: match[2].trim(),
  };
};

const isTransition = (line: string): boolean => {
  const normalized = normalizeLine(line);
  const transitionRe = /^(قطع|اختفاء|تحول|انتقال|fade|cut|dissolve|wipe)/i;
  return transitionRe.test(normalized);
};

/**
 * =========================
 *  Action Logic
 * =========================
 */

const ACTION_VERB_LIST =
  'يدخل|يخرج|ينظر|يرفع|تبتسم|ترقد|تقف|يبسم|يضع|يقول|تنظر|تربت|تقوم|يشق|تشق|تضرب|يسحب|يلتفت|يقف|يجلس|تجلس|يجري|تجري|يمشي|تمشي|يركض|تركض|يصرخ|اصرخ|يبكي|تبكي|يضحك|تضحك|يغني|تغني|يرقص|ترقص|يأكل|تأكل|يشرب|تشرب|ينام|تنام|يستيقظ|تستيقظ|يكتب|تكتب|يقرأ|تقرأ|يسمع|تسمع|يشم|تشم|يلمس|تلمس|يأخذ|تأخذ|يعطي|تعطي|يفتح|تفتح|يغلق|تغلق|يبدأ|تبدأ|ينتهي|تنتهي|يذهب|تذهب|يعود|تعود|يأتي|تأتي|يموت|تموت|يحيا|تحيا|يقاتل|تقاتل|ينصر|تنتصر|يخسر|تخسر|يرسم|ترسم|يصمم|تصمم|يخطط|تخطط|يقرر|تقرر|يفكر|تفكر|يتذكر|تتذكر|يحاول|تحاول|يستطيع|تستطيع|يريد|تريد|يحتاج|تحتاج|يبحث|تبحث|يجد|تجد|يفقد|تفقد|يحمي|تحمي|يراقب|تراقب|يخفي|تخفي|يكشف|تكشف|يكتشف|تكتشف|يعرف|تعرف|يتعلم|تتعلم|يعلم|تعلم|يوجه|توجه|يسافر|تسافر|يرحل|ترحل|يبقى|تبقى|ينتقل|تنتقل|يتغير|تتغير|ينمو|تنمو|يتطور|تتطور|يواجه|تواجه|يحل|تحل|يفشل|تفشل|ينجح|تنجح|يحقق|تحقق|ينهي|تنهي|يوقف|توقف|يستمر|تستمر|ينقطع|تنقطع|يرتبط|ترتبط|ينفصل|تنفصل|يتزوج|تتزوج|يطلق|تطلق|يولد|تولد|يكبر|تكبر|يشيخ|تشيخ|يمرض|تمرض|يشفي|تشفي|يصاب|تصاب|يتعافى|تتعافى|يقتل|تقتل|يُقتل|تُقتل|يختفي|تختفي|يظهر|تظهر|يختبئ|تختبئ|يطلب|تطلب|يأمر|تأمر|يمنع|تمنع|يسمح|تسمح|يوافق|توافق|يرفض|ترفض|يعتذر|تعتذر|يشكر|تشكر|يحيي|تحيي|يودع|تودع|يجيب|تجيب|يسأل|تسأل|يصيح|صيح|يهمس|همس|يصمت|صمت|يتكلم|تكلم|ينادي|تنادي|يحكي|تحكي|يروي|تروي|يقص|تقص|يتنهد|تتنهد|يئن|تئن|يتوقف|تتوقف|يستدير|تستدير|يحدق|تحدق|يلمح|تلمح';

const EXTRA_ACTION_VERBS =
  'نرى|نسمع|نلاحظ|نقترب|نبتعد|ننتقل|ترفع|ينهض|تنهض|تقتحم|يقتحم|يتبادل|يبتسم|يبدؤون|تفتح|يفتح|تدخل|يُظهر|يظهر|تظهر|يبدو|تبدو|تتنهد|يتنهد|يصمت|تصمت|يتحدث|تتحدث|يهمس|تهمس|ينصت|تنصت';

const ACTION_VERB_SET = new Set(
  (ACTION_VERB_LIST + '|' + EXTRA_ACTION_VERBS)
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean),
);

const isActionVerbStart = (line: string): boolean => {
  const firstToken = line.trim().split(/\s+/)[0] ?? '';
  const normalized = firstToken
    .replace(/[\u200E\u200F\u061C]/g, '')
    .replace(/[^\u0600-\u06FF]/g, '')
    .trim();
  if (!normalized) return false;
  if (ACTION_VERB_SET.has(normalized)) return true;

  const leadingParticles = ['و', 'ف', 'ل'];
  for (const p of leadingParticles) {
    if (normalized.startsWith(p) && normalized.length > 1) {
      const candidate = normalized.slice(1);
      if (ACTION_VERB_SET.has(candidate)) return true;
    }
  }

  return false;
};

const matchesActionStartPattern = (line: string): boolean => {
  const normalized = normalizeLine(line);

  const actionStartPatterns = [
    /^\s*(?:ثم\s+)?(?:و(?:هو|هي)\s+)?[يت][\u0600-\u06FF]{2,}(?:\s+\S|$)/,
    /^\s*(?:و|ف|ل)?(?:نرى|نسمع|نلاحظ|نقترب|نبتعد|ننتقل)(?:\s+\S|$)/,
    /^\s*(?:ثم\s+)?(?:و(?:هو|هي)\s+)?[يت][\u0600-\u06FF]{2,}(?:\s+\S|$)/,
    /^\s*(?:و|ف|ل)?(?:نرى|نسمع|نلاحظ|نقترب|نبتعد|ننتقل)(?:\s+\S|$)/,
    /^\s*(?:رأينا|سمعنا|لاحظنا|شاهدنا)(?:\s+\S|$)/,
    // Add imperative check for Action (e.g. ادخل، اخرج) if it starts with Alif
    /^\s*(?:ادخل|اخرج|انظر|استمع|اقترب|ابتعد|توقف)(?:\s+\S|$)/,
  ];

  return actionStartPatterns.some((pattern) => pattern.test(normalized));
};

const isLikelyAction = (line: string): boolean => {
  if (!line || !line.trim()) return false;

  const normalized = normalizeLine(line);

  if (matchesActionStartPattern(normalized)) return true;
  if (isActionVerbStart(normalized)) return true;

  return false;
};

/**
 * =========================
 *  Character Logic
 * =========================
 */

const CHARACTER_RE = /^\s*(?:صوت\s+)?[\u0600-\u06FF][\u0600-\u06FF\s0-9٠-٩]{0,30}:?\s*$/;

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

const isParenthetical = (line: string): boolean => {
  return /^[\(（].*?[\)）]$/.test(line.trim());
};

const parseInlineCharacterDialogue = (
  line: string,
): { characterName: string; dialogueText: string } | null => {
  const trimmed = line.trim();
  const inlineMatch = trimmed.match(/^([^:：]{1,60}?)\s*[:：]\s*(.+)$/);
  if (!inlineMatch) return null;

  const characterName = (inlineMatch[1] || '').trim();
  const dialogueText = (inlineMatch[2] || '').trim();
  if (!characterName || !dialogueText) return null;

  if (!CHARACTER_RE.test(`${characterName}: `)) return null;
  return { characterName, dialogueText };
};

const isCharacterLine = (
  line: string,
  context?: { lastFormat: string; isInDialogueBlock: boolean },
): boolean => {
  const raw = line ?? '';
  const trimmed = raw.trim();
  if (!trimmed) return false;

  if (isCompleteSceneHeader(trimmed) || isTransition(trimmed) || isParenthetical(trimmed)) {
    return false;
  }

  const normalized = normalizeLine(trimmed);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const wordCount = tokens.length;
  if (wordCount > 5) return false;

  const stopWords = new Set([
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

  const hasStopWord = tokens.some((t) => stopWords.has(t));
  const isStageDirection = STAGE_DIRECTION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  const isActionLike = isActionVerbStart(normalized) || matchesActionStartPattern(normalized);

  if (isActionLike || isStageDirection) return false;

  const hasColon = trimmed.includes(':') || trimmed.includes('：');

  if (hasColon && (trimmed.endsWith(':') || trimmed.endsWith('：'))) {
    if (wordCount > 4) return false;
    if (hasStopWord) return false;
    if (isActionLike || isStageDirection) return false;
    return true;
  }

  const arabicOnlyWithNumbers =
    /^[\s\u0600-\u06FF\d٠-٩\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+$/.test(
      normalized,
    );

  if (!hasColon && arabicOnlyWithNumbers) {
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 4) return false; // Allow slightly longer names (e.g. compound names)

    // Safeguard: Character names rarely contain dialogue punctuation
    if (/[؟!؟,،"«»]/.test(trimmed)) return false;

    if (isStageDirection || isActionLike) return false;
    if (tokens.some((t) => stopWords.has(t))) return false;

    return true;
  }

  if (!hasColon) return false;

  if (context) {
    if (context.isInDialogueBlock) {
      if (context.lastFormat === 'character') {
        return CHARACTER_RE.test(trimmed);
      }
      if (context.lastFormat === 'dialogue') {
        return false;
      }
    }

    if (context.lastFormat === 'action' && hasColon) {
      return CHARACTER_RE.test(trimmed);
    }
  }

  return CHARACTER_RE.test(trimmed);
};

const isLikelyDialogue = (line: string, previousFormat: string): boolean => {
  if (previousFormat === 'character' || previousFormat === 'parenthetical') {
    if (!isCompleteSceneHeader(line) && !isTransition(line) && !isCharacterLine(line)) {
      return true;
    }
  }
  return false;
};

/**
 * دالة ذكية لحساب احتمالية أن يكون السطر حواراً بناءً على محتواه اللغوي
 * Smart Linguistic Heuristic for Dialogue Detection
 */
const getDialogueProbability = (line: string): number => {
  let score = 0;
  const normalized = normalizeLine(line);

  // 1. Punctuation Indicators (علامات الترقيم الحوارية)
  if (/[؟?]/.test(line)) score += 3; // Question mark is a very strong indicator
  if (/!/.test(line)) score += 1; // Exclamation can be in action too, but often dialogue
  if (/\.\./.test(line)) score += 1; // Ellipses often indicate trailing dialogue

  // 2. Vocative Particles (أدوات النداء)
  // "Ya" followed by a word
  if (/\bيا\s+[\u0600-\u06FF]+/.test(normalized)) score += 4;
  if (/يا\s*([أا]خي|[أا]ختي|[يأ]سطى|باشا|بيه|هانم|مدام|أستاذ|ياعم|ياواد|يابنت)/.test(normalized))
    score += 2; // Specific common vocatives

  // 3. Conversational Start (بدايات حوارية شائعة)
  const conversationalStarts = [
    'ليه',
    'مين',
    'فين',
    'إمتى',
    'ازاي',
    'كام', // Questions
    'أنا',
    'انت',
    'إنتي',
    'احنا',
    'يا', // Pronouns/Vocative
    'بس',
    'طب',
    'ما',
    'مش',
    'لا',
    'أيوه',
    'أه', // Colloquial particles
    'طيب',
    'خلاص',
    'ياللا',
    'يلا',
    'عشان',
    'علشان', // Colloquial
    'يبقى',
    'كده',
    'هو',
    'هي',
    'دي',
    'ده', // Demonstratives/Aux
    'بقولك',
    'بقولك',
    'بتعمل',
    'هتعمل',
    'تعالى',
    'روح', // Common commands/questions
    'يلعن',
    'يخرب',
    'الله',
    'والله', // Common expressions
  ];
  const firstWord = normalized.split(' ')[0];
  if (conversationalStarts.includes(firstWord)) score += 2;

  // Check deeper in the sentence for conversational markers
  if (/\b(ده|دي|كده|عشان|علشان|عايز|عايزة|مش|هو|هي|احنا)\b/.test(normalized)) score += 1;

  // 4. Quotation Marks (علامات التنصيص)
  if (/["«»]/.test(line)) score += 2;

  // 5. Length Heuristic (الطول)
  if (normalized.length > 5 && normalized.length < 150) score += 1;

  // Penalties (عقوبات)
  if (isSceneHeader1(line) || isSceneHeader2(line)) score -= 10;

  // Adjusted Action Penalty: If it starts with action verb BUT has strong dialogue markers, reduce penalty or ignore
  if (isActionVerbStart(line)) {
    // If we have strong dialogue indicators (like "Ya" or "?"), the action verb might be part of dialogue (e.g. "Look at me!")
    // "انظر لي يا محمد" -> "Look" is imperative action verb, but "Ya" makes it dialogue.
    // So only penalize if score is currently low.
    if (score < 4) {
      score -= 3;
    }
  }

  return score;
};

/**
 * =========================
 *  Context Model
 * =========================
 */

const buildContext = (
  lines: string[],
  currentIndex: number,
  previousTypes: string[],
): LineContext => {
  const WINDOW_SIZE = 3;
  const currentLine = lines[currentIndex] || '';

  const previousLines: string[] = [];
  for (let i = Math.max(0, currentIndex - WINDOW_SIZE); i < currentIndex; i++) {
    previousLines.push(lines[i] || '');
  }

  const nextLines: string[] = [];
  for (let i = currentIndex + 1; i < Math.min(lines.length, currentIndex + WINDOW_SIZE + 1); i++) {
    nextLines.push(lines[i] || '');
  }

  const trimmedLine = currentLine.trim();
  const normalized = normalizeLine(currentLine);
  const stats = {
    wordCount: normalized.split(/\s+/).filter(Boolean).length,
    charCount: trimmedLine.length,
    hasColon: trimmedLine.includes(':') || trimmedLine.includes('：'),
    hasPunctuation: /[.!?،؛]/.test(trimmedLine),
    startsWithBullet: /^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+]/.test(currentLine),
    isShort: trimmedLine.length < 30,
    isLong: trimmedLine.length > 100,
  };

  const recentTypes = previousTypes.slice(-10);
  const lastType = previousTypes[previousTypes.length - 1];

  const isInDialogueBlock = recentTypes
    .slice(-3)
    .some((t) => t === 'character' || t === 'dialogue' || t === 'parenthetical');

  const isInSceneHeader =
    lastType === 'scene-header-top-line' ||
    lastType === 'scene-header-1' ||
    lastType === 'scene-header-2';

  let lastSceneDistance = -1;
  for (let i = previousTypes.length - 1; i >= 0; i--) {
    if (previousTypes[i]?.includes('scene-header')) {
      lastSceneDistance = previousTypes.length - 1 - i;
      break;
    }
  }

  let lastCharacterDistance = -1;
  for (let i = previousTypes.length - 1; i >= 0; i--) {
    if (previousTypes[i] === 'character') {
      lastCharacterDistance = previousTypes.length - 1 - i;
      break;
    }
  }

  return {
    previousLines,
    currentLine,
    nextLines,
    previousTypes,
    stats,
    pattern: {
      isInDialogueBlock,
      isInSceneHeader,
      lastSceneDistance,
      lastCharacterDistance,
    },
  };
};

/**
 * =========================
 *  Core Classification Pipeline
 * =========================
 */

const isSceneHeader3 = (line: string, ctx: LineContext): boolean => {
  const normalized = normalizeLine(line);
  const normalizedWithoutColon = normalized.replace(/:+\s*$/, '');
  const wordCount = normalizedWithoutColon.split(/\s+/).filter(Boolean).length;
  const lastType = ctx.previousTypes[ctx.previousTypes.length - 1];

  if (
    ['scene-header-top-line', 'scene-header-1', 'scene-header-2', 'transition'].includes(
      lastType,
    ) &&
    wordCount <= 12 &&
    !hasSentencePunctuation(line) &&
    !isActionVerbStart(normalizedWithoutColon) &&
    !matchesActionStartPattern(normalizedWithoutColon)
  ) {
    return true;
  }

  const KNOWN_PLACES =
    /^(مسجد|بيت|منزل|شارع|حديقة|مدرسة|جامعة|مكتب|محل|مستشفى|مطعم|فندق|سيارة|غرفة|قاعة|ممر|سطح|ساحة|مقبرة|مخبز|مكتبة|نهر|بحر|جبل|غابة|سوق|مصنع|بنك|محكمة|سجن|موقف|محطة|مطار|ميناء|كوبرى|نفق|مبنى|قصر|نادي|ملعب|ملهى|بار|كازينو|متحف|مسرح|سينما|معرض|مزرعة|مختبر|مستودع|مقهى|شركة|كهف|صالة|حمام|مطبخ|شرفة|ميدان|مخزن|مخازن|حرم|باحة|دار|روضة|معهد|مركز|عيادة|ورشة|مصلى|زاوية)/i;

  if (KNOWN_PLACES.test(normalizedWithoutColon)) {
    return true;
  }

  if (
    /^(منزل|بيت|مكتب|شقة|فيلا|قصر|محل|مصنع|مستشفى|مدرسة|جامعة|فندق|مطعم|مقهى|شركة|بنك|مركز)\s+[\w\s]+\s*[–—-]\s*[\w\s]+/i.test(
      normalizedWithoutColon,
    )
  ) {
    return true;
  }

  return false;
};

const isLikelyCharacter = (line: string, ctx: LineContext): boolean => {
  if (!ctx.stats.isShort || ctx.stats.wordCount > 5) return false;

  // Character names generally don't have dialogue punctuation
  // Unless it ends with colon (handled elsewhere)
  if (/[؟!؟"«»]/.test(line) && !line.includes(':')) return false;

  // Refined Logic (New):
  // Even if it HAS a colon, if the text before the colon is PURELY an imperative verb
  // it might be dialogue like "Enter:" (meaning "He says 'Enter'").
  // Though standard screenplay uses "NAME:", sometimes people write "Start:" as action?
  // User case: "ادخل:" -> This looks like an imperative verb "Edkhol".
  const namePart = line.split(':')[0].trim();
  const nameNormalized = normalizeLine(namePart);

  // List of verbs that might look like names but are commands
  const IMPERATIVE_VERBS = new Set([
    'ادخل',
    'اخرج',
    'انظر',
    'توقف',
    'اسمع',
    'تعال',
    'امش',
    'اكتب',
    'اقرأ',
  ]);
  if (IMPERATIVE_VERBS.has(nameNormalized)) {
    // If the "name" is just a command, treat it as Dialogue (or Action/Parenthetical based on context)
    // The user said: "ادخل:" was treated as character. They want it as Dialogue?
    // "ادخل:" -> Dialogue "Enter." (as in someone speaking the command)
    return false;
  }

  if (isTransition(line)) return false;
  if (isActionVerbStart(normalizeLine(line))) return false;

  if (ctx.stats.hasPunctuation && !ctx.stats.hasColon) return false;

  const nextLine = ctx.nextLines[0];
  if (nextLine) {
    if (isCompleteSceneHeader(nextLine) || isTransition(nextLine)) return false;
  }

  if (ctx.pattern.lastCharacterDistance === 1) return false;

  return true;
};

type ClassificationResult = {
  type: string;
  score: number;
  scores?: Record<string, ConfidenceScore>;
  decision?: PreLLMDecision;
};

type ProcessedLine = {
  id: string;
  text: string;
  type: string;
  score: number;
  decision?: PreLLMDecision;
};

const buildFixedResult = (type: string, score: number): ClassificationResult => ({
  type,
  score,
  decision: {
    shouldUseLLM: false,
    confidence: score,
    reason: 'rule_override',
    fallbackClassification: type,
  },
});

const isSimilarLine = (line1: string, line2: string): boolean => {
  const words1 = new Set(line1.split(/\s+/));
  const words2 = new Set(line2.split(/\s+/));
  for (const word of words1) {
    if (words2.has(word)) return true;
  }
  return false;
};

const getCorrectionSuggestions = (memory: PersistentMemory, line: string): string[] => {
  const suggestions: string[] = [];
  for (let i = memory.patterns.userCorrections.length - 1; i >= 0; i--) {
    const correction = memory.patterns.userCorrections[i];
    if (isSimilarLine(line, correction.line) && !suggestions.includes(correction.corrected)) {
      suggestions.push(correction.corrected);
    }
  }
  return suggestions;
};

const updateMemoryData = (memory: PersistentMemory, line: string, classification: string): void => {
  memory.lastModified = Date.now();
  memory.data.lastClassifications = [classification, ...memory.data.lastClassifications].slice(
    0,
    20,
  );

  if (classification === 'character') {
    const charName = line.replace(/[:：]/g, '').trim();
    if (charName) {
      if (!memory.data.commonCharacters.includes(charName)) {
        memory.data.commonCharacters.push(charName);
      }
      memory.data.characterDialogueMap[charName] =
        (memory.data.characterDialogueMap[charName] || 0) + 1;
    }
  }
};

const classifyWithContext = (line: string, ctx: LineContext): ClassificationResult => {
  const lastType = ctx.previousTypes[ctx.previousTypes.length - 1];
  const trimmed = line.trim();
  const normalized = normalizeLine(trimmed);
  const endsWithColon = trimmed.endsWith(':') || trimmed.endsWith('：');
  const isStageDirection = STAGE_DIRECTION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  const isActionLike = isActionVerbStart(normalized) || matchesActionStartPattern(normalized);

  if (isBasmala(line)) return buildFixedResult('basmala', 10);

  if (isCompleteSceneHeader(line)) return buildFixedResult('scene-header-top-line', 10);
  if (isSceneHeader1(line)) return buildFixedResult('scene-header-1', 10);
  if (isSceneHeader2(line)) return buildFixedResult('scene-header-2', 10);
  if (isTransition(line)) return buildFixedResult('transition', 10);

  if (endsWithColon && (isStageDirection || isActionLike)) {
    return buildFixedResult('action', 8);
  }

  if (isParenthetical(line)) {
    if (ctx.pattern.isInDialogueBlock || lastType === 'character') {
      return buildFixedResult('parenthetical', 9);
    }
  }

  if (ctx.pattern.isInSceneHeader && isSceneHeader3(line, ctx)) {
    return buildFixedResult('scene-header-3', 8);
  }

  const scores: Record<string, ConfidenceScore> = {
    'scene-header-top-line': confidenceScorer.calculateSceneHeaderConfidence(line, ctx),
    character: confidenceScorer.calculateCharacterConfidence(line, ctx),
    dialogue: confidenceScorer.calculateDialogueConfidence(line, ctx),
    action: confidenceScorer.calculateActionConfidence(line, ctx),
    transition: confidenceScorer.calculateTransitionConfidence(line),
  };

  let bestType = 'action';
  let bestScore = 0;

  for (const [type, confidence] of Object.entries(scores)) {
    if (confidence.score > bestScore) {
      bestScore = confidence.score;
      bestType = type;
    }
  }

  const decision = preLLMDecisionEngine.decide(line, scores, ctx);
  if (decision.fallbackClassification) {
    bestType = decision.fallbackClassification;
    bestScore = scores[bestType]?.score ?? decision.confidence;
  }

  return { type: bestType, score: bestScore, scores, decision };
};

/**
 * =========================
 *  Memory-Enhanced Classification
 * =========================
 */

const classifyWithContextAndMemory = async (
  line: string,
  ctx: LineContext,
  memory: PersistentMemory | null,
): Promise<ClassificationResult> => {
  const result = classifyWithContext(line, ctx);
  let classification = result.type;
  let score = result.score;

  if (!memory) return result;

  try {
    if (memory.settings.learningEnabled) {
      const suggestions = getCorrectionSuggestions(memory, line);
      if (suggestions.length > 0) {
        return {
          ...result,
          type: suggestions[0],
          score: Math.max(score, 9),
          decision: {
            shouldUseLLM: false,
            confidence: Math.max(score, 9),
            reason: 'memory_correction',
            fallbackClassification: suggestions[0],
          },
        };
      }
    }

    if (ctx.stats.isShort && !ctx.stats.hasPunctuation) {
      const normalized = normalizeLine(line).replace(/[:：]/g, '');

      const knownCharacter = memory.data.commonCharacters.find((char: string) => {
        const charNormalized = char.toLowerCase();
        const lineNormalized = normalized.toLowerCase();
        return charNormalized.includes(lineNormalized) || lineNormalized.includes(charNormalized);
      });

      if (knownCharacter) {
        if (ctx.stats.wordCount <= 3 && line.length < 40) {
          classification = 'character';
          score = 10;
        }
      }
    }

    const recentPattern = memory.data.lastClassifications.slice(0, 3).join('-');
    const lastType = ctx.previousTypes[ctx.previousTypes.length - 1];

    if (
      recentPattern.startsWith('character-dialogue') &&
      lastType === 'dialogue' &&
      !ctx.stats.hasColon &&
      isLikelyAction(line)
    ) {
      classification = 'action';
      score = getDialogueProbability(line);
    }

    if (
      recentPattern === 'dialogue-dialogue-dialogue' &&
      lastType === 'dialogue' &&
      !ctx.stats.hasColon &&
      !isCompleteSceneHeader(line)
    ) {
      classification = 'dialogue';
      score = 10;
    }

    if (recentPattern === 'action-action-action' && lastType === 'action' && ctx.stats.isLong) {
      classification = 'action';
      score = score < 5 ? score : 0;
    }

    if (classification === 'character') {
      const charName = line.replace(/[:：]/g, '').trim();
      const appearances = memory.data.characterDialogueMap[charName] || 0;

      if (appearances >= 3) {
        classification = 'character';
        score = 10;
      }
    }
  } catch (error) {
    logger.error('Memory', `خطأ في استخدام الذاكرة: ${error}`);
  }

  return { ...result, type: classification, score };
};

/**
 * =========================
 *  Smart Line Recovery (Layer A)
 * =========================
 */
const smartSplitIntoLines = (text: string): string => {
  let processed = text;

  // Pattern explanation:
  // (^|[^\S\n])  -> Match Start of string OR Whitespace that is NOT a newline
  // This ensures we don't match if it's already properly on a new line (preceded by \n)

  // 1. Scene Headers & Locations
  processed = processed.replace(
    /(^|[^\S\n])(INT\.|EXT\.|داخلي\.|خارجي\.|داخلي |خارجي |مشهد |Scene )/gi,
    '\n$2',
  );

  // 2. Scene Numbers (e.g., "مشهد 50")
  processed = processed.replace(/(^|[^\S\n])(مشهد|Scene)(\s*\d+)/gi, '\n$2$3');

  // 3. Times (Inject \n AFTER time if followed by text)
  // " - DAY Action..." -> " - DAY\nAction..."
  // Keep regular space check here, but ensure we don't duplicate newline if already there
  processed = processed.replace(/(\s|-)(نهار|ليل|صباح|مساء|فجر|Day|Night)(\s+)(?!\n)/gi, '$1$2\n');

  // 4. Transitions
  processed = processed.replace(/(^|[^\S\n])(CUT TO:|FADE IN:|قطع:|تلاشي:)/gi, '\n$2');

  // 5. Inline Character Dialogue: "اسم: نص..." -> split before the character name
  // Arabic names (1-3 tokens) followed by ':' or '：'
  processed = processed.replace(
    /(^|[^\S\n])([\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){0,2})\s*[:：]\s*/g,
    '\n$2: ',
  );

  // 6. List markers inside merged text (keep as strong boundaries)
  // Examples: "- ..." , "• ..." , " ..."
  processed = processed
    .replace(/(^|[^\S\n])(-)\s+/g, '\n$2 ')
    .replace(/(^|[^\S\n])([•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+])\s*/g, '\n$2 ');

  return processed;
};

/**
 * =========================
 *  Paste Handler
 * =========================
 */

export const handlePaste = async (
  e: React.ClipboardEvent,
  editorRef: React.RefObject<HTMLDivElement | null>,
  getFormatStylesFn: (formatType: string, size: string, font: string) => React.CSSProperties,
  updateContentFn: () => void,
  memoryManager?: PersistentMemoryManager | null,
  sessionId = `session-${Date.now()}`,
  onAIReviewNeeded?: (payload: AIPayload) => void,
): Promise<void> => {
  e.preventDefault();

  // Use passed memory manager or singleton default (allow explicit null to disable)
  const memoryManagerResolved =
    memoryManager === null ? null : memoryManager || defaultMemoryManager;

  // Load context from storage
  let memoryData: PersistentMemory | null = null;
  if (memoryManagerResolved && typeof memoryManagerResolved.load === 'function') {
    try {
      memoryData = await memoryManagerResolved.load(sessionId);
    } catch (err) {
      logger.warning('Paste', 'Failed to load context memory', err);
    }
  }

  // Fallback if load failed or returned null (new session)
  if (!memoryData && memoryManagerResolved) {
    memoryData = await defaultMemoryManager.load(sessionId);
  }

  if (memoryData && typeof window !== 'undefined') {
    try {
      const localSettings = window.localStorage.getItem('filmlane_classification_settings');
      if (localSettings) {
        const parsed = JSON.parse(localSettings) as Partial<PersistentMemory['settings']>;
        memoryData.settings = {
          ...memoryData.settings,
          ...parsed,
        };
      }
    } catch (error) {
      logger.warning('Paste', 'Failed to load classification settings', error);
    }
  }

  logger.info('Paste', `🚀 بدء عملية اللصق(Session: ${sessionId})`);

  const textData = e.clipboardData.getData('text/plain');
  if (!textData) {
    logger.warning('Paste', 'لا يوجد نص للصق');
    return;
  }

  // Normalize line endings (Fix Windows \r\n issues)
  let textToProcess = textData.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    logger.error('Paste', 'لا يوجد تحديد نشط');
    return;
  }

  // --- Smart Line Recovery (Layer A) ---
  const basicLinesCheck = textToProcess.split('\n');
  const looksLikeMergedStructuredText =
    /(^|[^\S\n])(?:-|•||\u2022|\u25AA)\s+/.test(textToProcess) ||
    /(^|[^\S\n])[\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){0,2}\s*[:：]\s*/.test(textToProcess);

  if (
    basicLinesCheck.length <= 2 &&
    (textToProcess.length >= 300 || looksLikeMergedStructuredText)
  ) {
    logger.info('Paste', '🔧 Triggering Smart Line Recovery (Merged Text Detected)');
    textToProcess = smartSplitIntoLines(textToProcess);
  }

  const lines = textToProcess.split('\n').filter((line) => line.trim());
  logger.info('Paste', `📋 بدء معالجة ${lines.length} سطر`);
  logger.info(
    'Paste',
    `أول 3 أسطر: ${lines
      .slice(0, 3)
      .map((l) => `"${l.substring(0, 30)}..."`)
      .join(', ')}`,
  );

  let formattedHTML = '';
  let previousFormatClass = 'action';
  const classifiedTypes: string[] = [];
  const processedBlock: ProcessedLine[] = [];

  logger.info('Processing', `بدء معالجة ${lines.length} سطر...`);

  const llmThreshold = memoryData?.settings?.llmThreshold ?? 5.0;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (!trimmedLine) continue;

    const lineId = `line-${sessionId}-${i}`;

    const strippedLine = stripLeadingBullets(trimmedLine);
    const ctx = await getContextAnalysis(lines, classifiedTypes, i);

    let formatClass = 'action';
    let cleanLine = strippedLine;

    const inlineParsed = parseInlineCharacterDialogue(strippedLine);
    if (inlineParsed) {
      const { characterName, dialogueText } = inlineParsed;

      const charStyles = getFormatStylesFn('character', '', '');
      const dialogueStyles = getFormatStylesFn('dialogue', '', '');

      const charMarginTop = getSpacingMarginTop(previousFormatClass, 'character');
      const charHTML = buildLineDivHTML(
        'format-character',
        charStyles,
        characterName + ':',
        charMarginTop,
        `${lineId}-char`,
        10,
      );
      const dialogueHTML = buildLineDivHTML(
        'format-dialogue',
        dialogueStyles,
        dialogueText,
        '0',
        `${lineId}-dial`,
        10,
      );

      formattedHTML += charHTML + dialogueHTML;
      classifiedTypes.push('character', 'dialogue');
      previousFormatClass = 'dialogue';

      // CRITICAL FIX: Sync processedBlock with the split lines
      processedBlock.push({
        id: `${lineId}-char`,
        text: characterName + ':',
        type: 'character',
        score: 10,
      });
      processedBlock.push({
        id: `${lineId}-dial`,
        text: dialogueText,
        type: 'dialogue',
        score: 10,
      });

      if (memoryData) {
        updateMemoryData(memoryData, characterName, 'character');
        updateMemoryData(memoryData, dialogueText, 'dialogue');
      }

      continue;
    }

    const res = await classifyWithContextAndMemory(strippedLine, ctx, memoryData);

    const classification = res.type;
    const score = res.score;
    // Store for AI review
    processedBlock.push({
      id: lineId,
      text: strippedLine,
      type: classification,
      score,
      decision: res.decision,
    });

    if (memoryData) {
      updateMemoryData(memoryData, strippedLine, classification);
    }

    if (classification === 'scene-header-top-line') {
      const parts = splitSceneHeader(strippedLine);
      if (parts) {
        const topLevelStyles = getFormatStylesFn('scene-header-top-line', '', '');
        const part1Styles = getFormatStylesFn('scene-header-1', '', '');
        const part2Styles = getFormatStylesFn('scene-header-2', '', '');

        const part1HTML = buildLineDivHTML(
          'format-scene-header-1',
          part1Styles,
          parts.number,
          undefined,
          `${lineId}-p1`,
          score,
        );
        const part2HTML = buildLineDivHTML(
          'format-scene-header-2',
          part2Styles,
          parts.description,
          undefined,
          `${lineId}-p2`,
          score,
        );

        const topLevelMarginTop = getSpacingMarginTop(previousFormatClass, 'scene-header-top-line');
        const topLevelDiv = document.createElement('div');
        topLevelDiv.className = 'format-scene-header-top-line';
        const topLevelStylesWithSpacing = { ...topLevelStyles };
        if (topLevelMarginTop) {
          topLevelStylesWithSpacing.marginTop = topLevelMarginTop;
        }
        topLevelDiv.setAttribute('style', cssObjectToString(topLevelStylesWithSpacing));
        topLevelDiv.dataset.confidence = String(score);
        topLevelDiv.id = lineId;
        topLevelDiv.innerHTML = part1HTML + part2HTML;

        formattedHTML += topLevelDiv.outerHTML;

        classifiedTypes.push('scene-header-top-line');
        previousFormatClass = 'scene-header-top-line';
        continue;
      }
    }

    formatClass = classification;
    cleanLine = strippedLine;

    // Add colon after character name
    if (formatClass === 'character' && !cleanLine.endsWith(':') && !cleanLine.endsWith('：')) {
      cleanLine = cleanLine + ':';
    }

    const marginTop = getSpacingMarginTop(previousFormatClass, formatClass);
    const styles = getFormatStylesFn(formatClass, '', '');
    const lineHTML = buildLineDivHTML(
      `format-${formatClass}`,
      styles,
      cleanLine,
      marginTop,
      lineId,
      score,
    );
    formattedHTML += lineHTML;

    classifiedTypes.push(formatClass);
    previousFormatClass = formatClass;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const tempContainer = document.createElement('div');
  tempContainer.innerHTML = formattedHTML;

  const fragment = document.createDocumentFragment();
  while (tempContainer.firstChild) {
    fragment.appendChild(tempContainer.firstChild);
  }

  range.insertNode(fragment);
  selection.removeAllRanges();

  const newRange = document.createRange();
  if (editorRef.current && editorRef.current.lastChild) {
    newRange.selectNodeContents(editorRef.current.lastChild);
    newRange.collapse(false);
    selection.addRange(newRange);
  }

  updateContentFn();

  logger.info('Paste', '✅ تم إكمال عملية اللصق والتنسيق');

  if (memoryManagerResolved && memoryData && typeof memoryManagerResolved.save === 'function') {
    await memoryManagerResolved.save(sessionId, memoryData);
  }

  // TRIGGER AI REVIEW (BACKGROUND)
  if (onAIReviewNeeded && processedBlock.length > 0) {
    // Check if any line in the block looks suspicious
    let shouldReview = false;
    let triggeredLines = 0;
    const reasonsMap: Record<string, number> = {};

    // Use processedBlock for context to alignment with what we just built (including splits)
    const reviewLines = processedBlock.map((p) => p.text);

    for (let i = 0; i < processedBlock.length; i++) {
      const item = processedBlock[i];
      const previousTypesForReview = processedBlock.slice(0, i).map((p) => p.type);
      const reviewCtx = await getContextAnalysis(reviewLines, previousTypesForReview, i);

      if (item.decision?.shouldUseLLM) {
        shouldReview = true;
        triggeredLines++;
        const r = item.decision.reason || 'pre_llm_decision';
        reasonsMap[r] = (reasonsMap[r] || 0) + 1;
        continue;
      }

      const result = shouldTriggerReview(item.text, item.type, item.score, reviewCtx, llmThreshold);
      if (result.trigger) {
        shouldReview = true;
        triggeredLines++;
        const r = result.reason || 'Unknown';
        reasonsMap[r] = (reasonsMap[r] || 0) + 1;
      }
    }

    if (shouldReview) {
      logger.info('Paste', '🤖 AI Review Triggered.', { triggeredLines, reasons: reasonsMap });
      const reviewBlock = processedBlock.filter(
        (item) => item.score < llmThreshold || item.decision?.shouldUseLLM,
      );
      const payload = constructAIRequestPayload(reviewBlock, [], {
        total_lines: processedBlock.length,
        triggered_lines: triggeredLines,
        reasons: reasonsMap,
      });
      onAIReviewNeeded(payload);
    }
  }
};
