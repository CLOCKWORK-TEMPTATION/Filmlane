import React from 'react';
import { logger } from './logger';
import {
  ContextMemoryManager,
} from './context-memory-manager';
import type { ContextMemory, LineContext } from '@/types/screenplay';
import { getFormatStyles } from './editor-styles';

/**
 * =========================
 *  Utilities
 * =========================
 */

const cssObjectToString = (styles: React.CSSProperties): string => {
  return Object.entries(styles)
    .map(([key, value]) => {
      const cssKey = key.replace(
        /[A-Z]/g,
        (match) => `-${match.toLowerCase()}`,
      );
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
const getSpacingMarginTop = (
  previousFormat: string,
  currentFormat: string,
): string => {
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
    if (currentFormat === 'action' || currentFormat === 'character' || currentFormat === 'transition') {
      return '12pt';
    }
  }

  if (previousFormat === 'dialogue') {
    if (currentFormat === 'character' || currentFormat === 'action' || currentFormat === 'transition') {
      return '12pt';
    }
  }

  if (previousFormat === 'parenthetical') {
    if (currentFormat === 'character' || currentFormat === 'action' || currentFormat === 'transition') {
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
): string => {
  const div = document.createElement('div');
  div.className = className;

  const finalStyles = { ...styles };
  if (marginTop) {
    finalStyles.marginTop = marginTop;
  }

  div.setAttribute('style', cssObjectToString(finalStyles));
  div.textContent = text;
  return div.outerHTML;
};

const stripLeadingBullets = (input: string): string => {
  return input.replace(
    /^[\s\u200E\u200F\u061C\ufeFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+\-]+\s*/,
    '',
  );
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

const isSceneHeader2 = (line: string): boolean => {
  const normalized = normalizeLine(line)
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hasTime = TIME_RE.test(normalized);
  const hasLocation = LOCATION_RE.test(normalized);
  return hasTime && hasLocation;
};

const isCompleteSceneHeader = (line: string): boolean => {
  const normalized = normalizeLine(line);
  return SCENE_NUMBER_EXACT_RE.test(normalized) && isSceneHeader2(normalized);
};

const splitSceneHeader = (
  line: string,
): { number: string; description: string } | null => {
  const match = line.match(
    /^\s*((?:مشهد|scene)\s*[0-9٠-٩]+)\s*[-–—:،]?\s*(.*)/i,
  );
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
  'نرى|نسمع|نلاحظ|نقترب|نبتعد|ننتقل|ترفع|ينهض|تنهض|تقتحم|يقتحم|يتبادل|يبتسم|يبدؤون|تفتح|يفتح|تدخل|يُظهر|يظهر|تظهر';

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

const CHARACTER_RE =
  /^\s*(?:صوت\s+)?[\u0600-\u06FF][\u0600-\u06FF\s0-9٠-٩]{0,30}:?\s*$/;

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

  if (!CHARACTER_RE.test(`${characterName}:`)) return null;
  return { characterName, dialogueText };
};

const isCharacterLine = (
  line: string,
  context?: { lastFormat: string; isInDialogueBlock: boolean },
): boolean => {
  const raw = line ?? '';
  const trimmed = raw.trim();
  if (!trimmed) return false;

  if (
    isCompleteSceneHeader(trimmed) ||
    isTransition(trimmed) ||
    isParenthetical(trimmed)
  ) {
    return false;
  }

  const normalized = normalizeLine(trimmed);
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount > 5) return false;

  if (isActionVerbStart(normalized)) return false;
  if (matchesActionStartPattern(normalized)) return false;

  const hasColon = trimmed.includes(':') || trimmed.includes('：');

  if (hasColon && (trimmed.endsWith(':') || trimmed.endsWith('：')))
    return true;

  const arabicOnlyWithNumbers =
    /^[\s\u0600-\u06FF\d٠-٩\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+$/.test(
      normalized,
    );

  if (!hasColon && arabicOnlyWithNumbers) {
    const tokens = normalized.split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens.length > 4) return false; // Allow slightly longer names (e.g. compound names)

    // Safeguard: Character names rarely contain dialogue punctuation
    if (/[؟!؟,،"«»]/.test(trimmed)) return false;

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
    if (
      !isCompleteSceneHeader(line) &&
      !isTransition(line) &&
      !isCharacterLine(line)
    ) {
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
  if (/يا\s*([أا]خي|[أا]ختي|[يأ]سطى|باشا|بيه|هانم|مدام|أستاذ|ياعم|ياواد|يابنت)/.test(normalized)) score += 2; // Specific common vocatives

  // 3. Conversational Start (بدايات حوارية شائعة)
  const conversationalStarts = [
    'ليه', 'مين', 'فين', 'إمتى', 'ازاي', 'كام', // Questions
    'أنا', 'انت', 'إنتي', 'احنا', 'يا', // Pronouns/Vocative
    'بس', 'طب', 'ما', 'مش', 'لا', 'أيوه', 'أه', // Colloquial particles
    'طيب', 'خلاص', 'ياللا', 'يلا', 'عشان', 'علشان', // Colloquial
    'يبقى', 'كده', 'هو', 'هي', 'دي', 'ده', // Demonstratives/Aux
    'بقولك', 'بقولك', 'بتعمل', 'هتعمل', 'تعالى', 'روح', // Common commands/questions
    'يلعن', 'يخرب', 'الله', 'والله', // Common expressions
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
  for (
    let i = currentIndex + 1;
    i < Math.min(lines.length, currentIndex + WINDOW_SIZE + 1);
    i++
  ) {
    nextLines.push(lines[i] || '');
  }

  const trimmedLine = currentLine.trim();
  const normalized = normalizeLine(currentLine);
  const stats = {
    wordCount: normalized.split(/\s+/).filter(Boolean).length,
    charCount: trimmedLine.length,
    hasColon: trimmedLine.includes(':') || trimmedLine.includes('：'),
    hasPunctuation: /[.!?،؛]/.test(trimmedLine),
    startsWithBullet:
      /^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+]/.test(
        currentLine,
      ),
    isShort: trimmedLine.length < 30,
    isLong: trimmedLine.length > 100,
  };

  const recentTypes = previousTypes.slice(-10);
  const lastType = previousTypes[previousTypes.length - 1];

  const isInDialogueBlock = recentTypes
    .slice(-3)
    .some(
      (t) => t === 'character' || t === 'dialogue' || t === 'parenthetical',
    );

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
    ['scene-header-top-line', 'scene-header-1', 'scene-header-2'].includes(
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
  const IMPERATIVE_VERBS = new Set(['ادخل', 'اخرج', 'انظر', 'توقف', 'اسمع', 'تعال', 'امش', 'اكتب', 'اقرأ']);
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

const classifyWithContext = (line: string, ctx: LineContext): string => {
  const lastType = ctx.previousTypes[ctx.previousTypes.length - 1];
  const nextLine = ctx.nextLines[0];

  if (isBasmala(line)) return 'basmala';

  if (isCompleteSceneHeader(line)) return 'scene-header-top-line';
  if (isSceneHeader1(line)) return 'scene-header-1';
  if (isSceneHeader2(line)) return 'scene-header-2';
  if (isTransition(line)) return 'transition';

  if (isParenthetical(line)) {
    // Parenthetical logic refined:
    // It's a parenthetical if it's in a dialogue block OR follows a character immediately
    if (
      ctx.pattern.isInDialogueBlock ||
      lastType === 'character'
    ) {
      return 'parenthetical';
    }
  }

  if (isLikelyAction(line)) {
    return 'action';
  }

  if (ctx.pattern.isInSceneHeader) {
    if (isSceneHeader3(line, ctx)) {
      return 'scene-header-3';
    }
  }

  if (ctx.pattern.isInDialogueBlock) {
    if (lastType === 'character' || lastType === 'parenthetical') {
      if (
        !isCharacterLine(line, {
          lastFormat: lastType,
          isInDialogueBlock: true,
        })
      ) {
        return 'dialogue';
      }
    }
    if (
      lastType === 'dialogue' &&
      !ctx.stats.hasColon &&
      !isCompleteSceneHeader(line)
    ) {
      return 'dialogue';
    }
  }

  if (ctx.stats.isShort && ctx.stats.hasColon) {
    if (
      isCharacterLine(line, {
        lastFormat: lastType,
        isInDialogueBlock: ctx.pattern.isInDialogueBlock,
      })
    ) {
      return 'character';
    }
  }

  if (ctx.stats.isShort && nextLine && nextLine.trim().length > 20) {
    if (isLikelyCharacter(line, ctx)) {
      return 'character';
    }
  }

  if (ctx.stats.isLong && ctx.stats.hasPunctuation) {
    return 'action';
  }

  if (ctx.stats.startsWithBullet) {
    const parsed = parseInlineCharacterDialogue(
      line
        .replace(/^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+]/, '')
        .trim(),
    );
    if (!parsed) {
      return 'action';
    }
  }

  // --- Smart Fallback (الحل الذكي والجذري) ---
  // If we haven't classified it yet, check linguistic probability
  // instead of blindly defaulting to 'action'.
  const dialogueScore = getDialogueProbability(line);
  // Threshold: 3 means at least a question mark OR a vocative particle OR combination of weaker signals
  if (dialogueScore >= 3) {
    return 'dialogue';
  }

  return 'action';
};

/**
 * =========================
 *  Memory-Enhanced Classification
 * =========================
 */

const classifyWithContextAndMemory = async (
  line: string,
  ctx: LineContext,
  memoryManager: ContextMemoryManager | null,
  sessionId: string,
): Promise<string> => {
  let classification = classifyWithContext(line, ctx);

  if (!memoryManager) return classification;

  try {
    const memory: ContextMemory | null = await memoryManager.loadContext(
      sessionId,
    );
    if (!memory) return classification;

    if (ctx.stats.isShort && !ctx.stats.hasPunctuation) {
      const normalized = normalizeLine(line).replace(/[:：]/g, '');

      const knownCharacter = memory.data.commonCharacters.find((char) => {
        const charNormalized = char.toLowerCase();
        const lineNormalized = normalized.toLowerCase();
        return (
          charNormalized.includes(lineNormalized) ||
          lineNormalized.includes(charNormalized)
        );
      });

      if (knownCharacter) {
        if (ctx.stats.wordCount <= 3 && line.length < 40) {
          classification = 'character';
        }
      }
    }

    const recentPattern = memory.data.lastClassifications
      .slice(0, 3)
      .join('-');
    const lastType = ctx.previousTypes[ctx.previousTypes.length - 1];

    if (
      recentPattern.startsWith('character-dialogue') &&
      lastType === 'dialogue' &&
      !ctx.stats.hasColon &&
      isLikelyAction(line)
    ) {
      classification = 'action';
    }

    if (
      recentPattern === 'dialogue-dialogue-dialogue' &&
      lastType === 'dialogue' &&
      !ctx.stats.hasColon &&
      !isCompleteSceneHeader(line)
    ) {
      classification = 'dialogue';
    }

    if (
      recentPattern === 'action-action-action' &&
      lastType === 'action' &&
      ctx.stats.isLong
    ) {
      classification = 'action';
    }

    if (classification === 'character') {
      const charName = line.replace(/[:：]/g, '').trim();
      const appearances = memory.data.characterDialogueMap[charName] || 0;

      if (appearances >= 3) {
        classification = 'character';
      }
    }
  } catch (error) {
    logger.error('Memory', `خطأ في استخدام الذاكرة: ${error}`);
  }

  return classification;
};

/**
 * =========================
 *  Paste Handler
 * =========================
 */

export const handlePaste = async (
  e: React.ClipboardEvent,
  editorRef: React.RefObject<HTMLDivElement | null>,
  getFormatStylesFn: (
    formatType: string,
    size: string,
    font: string,
  ) => React.CSSProperties,
  updateContentFn: () => void,
  memoryManager: ContextMemoryManager | null = null,
  sessionId: string = `session-${Date.now()}`,
): Promise<void> => {
  e.preventDefault();

  logger.info('Paste', `🚀 بدء عملية اللصق (Session: ${sessionId})`);

  const textData = e.clipboardData.getData('text/plain');
  if (!textData) {
    logger.warning('Paste', 'لا يوجد نص للصق');
    return;
  }

  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) {
    logger.error('Paste', 'لا يوجد تحديد نشط');
    return;
  }

  const lines = textData.split('\n').filter((line) => line.trim());
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

  logger.info('Processing', `بدء معالجة ${lines.length} سطر...`);

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (!trimmedLine) continue;

    const strippedLine = stripLeadingBullets(trimmedLine);
    const ctx = buildContext(lines, i, classifiedTypes);

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
      );
      const dialogueHTML = buildLineDivHTML(
        'format-dialogue',
        dialogueStyles,
        dialogueText,
        '0',
      );

      formattedHTML += charHTML + dialogueHTML;
      classifiedTypes.push('character', 'dialogue');
      previousFormatClass = 'dialogue';
      continue;
    }

    const classification = await classifyWithContextAndMemory(
      strippedLine,
      ctx,
      memoryManager,
      sessionId,
    );

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
        );
        const part2HTML = buildLineDivHTML(
          'format-scene-header-2',
          part2Styles,
          parts.description,
        );

        const topLevelMarginTop = getSpacingMarginTop(previousFormatClass, 'scene-header-top-line');
        const topLevelDiv = document.createElement('div');
        topLevelDiv.className = 'format-scene-header-top-line';
        const topLevelStylesWithSpacing = { ...topLevelStyles };
        if (topLevelMarginTop) {
          topLevelStylesWithSpacing.marginTop = topLevelMarginTop;
        }
        topLevelDiv.setAttribute('style', cssObjectToString(topLevelStylesWithSpacing));
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
};
