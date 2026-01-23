Claude’s Plan
خطة تنفيذية لنظام تصنيف سيناريو هجين (Hybrid Screenplay Classification System)
ملخص تنفيذي
هذه الخطة تعالج جميع نقاط الضعف المحددة في المستند العربي من خلال بناء نظام هجين يجمع بين:

قواعد محسّنة مع نظام ثقة (Confidence Scoring)
سياق متدرج وذاكرة موسعة
تقليل الاعتماد على LLM عبر آلية قرار مسبقة
التعلم من المستخدم والتغذية الراجعة
دمج نماذج ML صغيرة (استراتيجية بديلة تدريجية)
الملفات الحرجة الحالية (يجب فهمها قبل التعديل)
الملف	الوصف	أهميته
paste-classifier.ts	نظام التصنيف الأساسي + Regex + AI trigger	⭐⭐⭐⭐⭐
context-memory-manager.ts	إدارة الذاكرة الحالية (in-memory فقط)	⭐⭐⭐⭐
ai-reviewer.ts	"Method of Doubt" لـ LLM trigger	⭐⭐⭐⭐
screenplay-service.ts	خدمة الاتصال بـ vLLM	⭐⭐⭐
api/ai-proxy/route.ts	Proxy لـ LLM المحلي	⭐⭐⭐
EditorArea.tsx	واجهة المحرر الرئيسية	⭐⭐⭐
المرحلة 1: نظام الثقة والقواعد المحسّنة (Confidence Scoring)
1.1 إنشاء ملف الثقة (NEW)
الملف: src/utils/classification/confidence-scorer.ts


/**
 * نظام حساب الثقة للتصنيف
 * يعطي كل تصنيف درجة من 0-10 مع مصادر الثقة
 */

export interface ConfidenceScore {
  score: number; // 0-10
  sources: string[]; // أي قواعد ساهمت
  metadata: {
    ruleMatches: Record<string, boolean>;
    weightedSum: number;
  };
}

export class ConfidenceScorer {
  private readonly weights = {
    exactPattern: 3.0,      // تطابق تام (INT./EXT., بسم الله)
    contextPattern: 2.0,    // سياق متوقع
    linguisticPattern: 1.0, // مؤشرات لغوية
    contextBoost: 1.5,      // تعزيز سياقي
    memoryBoost: 2.0,       // شخصيات/أماكن معروفة
  };

  // حساب ثقة ترويسة المشهد
  calculateSceneHeaderConfidence(line: string, ctx: LineContext): ConfidenceScore {
    let score = 0;
    const sources: string[] = [];
    const matches: Record<string, boolean> = {};

    // قواعد من file:src/utils/paste-classifier.ts:165-192
    const SCENE_NUMBER_RE = /(?:مشهد|scene)\s*([0-9٠-٩]+)/i;
    const TIME_RE = /(نهار|ليل|صباح|مساء|فجر)/i;
    const LOCATION_RE = /(داخلي|خارجي)/i;

    if (SCENE_NUMBER_RE.test(line)) {
      score += this.weights.exactPattern;
      sources.push('scene_number');
      matches.sceneNumber = true;
    }

    if (TIME_RE.test(line)) {
      score += this.weights.contextPattern;
      sources.push('time_marker');
      matches.timeMarker = true;
    }

    if (LOCATION_RE.test(line)) {
      score += this.weights.contextPattern;
      sources.push('location_marker');
      matches.locationMarker = true;
    }

    // إذا في سياق مشهد، زود الثقة
    if (ctx.pattern.isInSceneHeader) {
      score += this.weights.contextBoost;
      sources.push('scene_context');
    }

    return { score, sources, metadata: { ruleMatches: matches, weightedSum: score } };
  }

  // حساب ثقة اسم الشخصية (مهم للعربية بدون أحرف كبيرة)
  calculateCharacterConfidence(line: string, ctx: LineContext): ConfidenceScore {
    let score = 0;
    const sources: string[] = [];
    const matches: Record<string, boolean> = {};

    const trimmed = line.trim();
    const hasColon = trimmed.includes(':') || trimmed.includes('：');

    // قواعد من file:src/utils/paste-classifier.ts:312-400
    const CHARACTER_RE = /^\s*(?:صوت\s+)?[\u0600-\u06FF][\u0600-\u06FF\s0-9٠-٩]{0,30}:?\s*$/;

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

    // التحقق من stop words
    const stopWords = new Set([
      'في', 'على', 'من', 'إلى', 'داخل', 'خارج', 'أمام', 'خلف',
      'تحت', 'فوق', 'بين', 'حول', 'ثم', 'بعد', 'قبل', 'عندما'
    ]);

    const hasStopWord = trimmed.split(/\s+/).some(t => stopWords.has(t));
    if (!hasStopWord) {
      score += this.weights.linguisticPattern;
      sources.push('no_stop_words');
      matches.noStopWords = true;
    }

    // السياق: بعد action، غالباً character
    if (ctx.previousTypes.slice(-1)[0] === 'action') {
      score += this.weights.contextBoost;
      sources.push('after_action');
      matches.afterAction = true;
    }

    return { score, sources, metadata: { ruleMatches: matches, weightedSum: score } };
  }

  // حساب ثقة الحوار (dialogue)
  calculateDialogueConfidence(line: string, ctx: LineContext): ConfidenceScore {
    let score = 0;
    const sources: string[] = [];
    const matches: Record<string, boolean> = {};

    // قواعد لغوية من file:src/utils/paste-classifier.ts:419-469
    if (/[؟?]/.test(line)) {
      score += 3; // علامة استفهام مؤشر قوي
      sources.push('question_mark');
      matches.questionMark = true;
    }

    if (/\bيا\s+[\u0600-\u06FF]+/.test(line)) {
      score += 4; // أدوات النداء
      sources.push('vocative_particle');
      matches.vocativeParticle = true;
    }

    // السياق: بعد character أو parenthetical
    const lastType = ctx.previousTypes.slice(-1)[0];
    if (lastType === 'character' || lastType === 'parenthetical') {
      score += this.weights.exactPattern;
      sources.push('after_character');
      matches.afterCharacter = true;
    }

    // الطول المناسب للحوار
    const wordCount = line.split(/\s+/).length;
    if (wordCount >= 3 && wordCount <= 30) {
      score += this.weights.linguisticPattern;
      sources.push('dialogue_length');
      matches.dialogueLength = true;
    }

    return { score, sources, metadata: { ruleMatches: matches, weightedSum: score } };
  }

  // حساب ثقة Action
  calculateActionConfidence(line: string, ctx: LineContext): ConfidenceScore {
    let score = 0;
    const sources: string[] = [];
    const matches: Record<string, boolean> = {};

    // استخدام ACTION_VERB_SET من file:src/utils/paste-classifier.ts:224-235
    const firstToken = line.trim().split(/\s+/)[0] || '';
    const normalized = firstToken.replace(/[^\u0600-\u06FF]/g, '');

    // Action verbs (قائمة موسعة من الملف الحالي)
    const ACTION_VERBS = ['يدخل', 'يخرج', 'ينظر', 'يرفع', 'يجلس', 'يقف', 'يجري', 'يمشي', ...];
    if (ACTION_VERBS.includes(normalized)) {
      score += this.weights.exactPattern;
      sources.push('action_verb');
      matches.actionVerb = true;
    }

    // الجمل الطوغة مع علامات ترقيم = action
    if (ctx.stats.isLong && ctx.stats.hasPunctuation) {
      score += this.weights.contextPattern;
      sources.push('long_with_punctuation');
      matches.longWithPunctuation = true;
    }

    return { score, sources, metadata: { ruleMatches: matches, weightedSum: score } };
  }

  // حساب ثقة Transition
  calculateTransitionConfidence(line: string): ConfidenceScore {
    let score = 0;
    const sources: string[] = [];
    const matches: Record<string, boolean> = {};

    // قواعد من file:src/utils/paste-classifier.ts:212-216
    const transitionKeywords = /^(قطع|اختفاء|تحول|انتقال|fade|cut|dissolve|wipe)/i;

    if (transitionKeywords.test(line)) {
      score += 10; // مؤشر قوي جداً
      sources.push('transition_keyword');
      matches.transitionKeyword = true;
    }

    return { score, sources, metadata: { ruleMatches: matches, weightedSum: score } };
  }
}

export const confidenceScorer = new ConfidenceScorer();
1.2 محرك قرار ما قبل LLM (NEW)
الملف: src/utils/classification/pre-llm-decision.ts


/**
 * محرك القرار قبل استدعاء LLM
 * يقرر ما إذا كان يحتاج LLM أم لا بناءً على الثقة
 */

import { ConfidenceScore } from './confidence-scorer';
import { LineContext } from '@/types/screenplay';

export interface PreLLMDecision {
  shouldUseLLM: boolean;
  confidence: number;
  reason: string;
  fallbackClassification?: string;
}

export class PreLLMDecisionEngine {
  // عتبات الثقة (قابلة للتكوين)
  private readonly HIGH_CONFIDENCE_THRESHOLD = 7.5;
  private readonly MEDIUM_CONFIDENCE_THRESHOLD = 5.0;
  private readonly LOW_CONFIDENCE_THRESHOLD = 3.0;

  decide(
    line: string,
    scores: Record<string, ConfidenceScore>,
    ctx: LineContext
  ): PreLLMDecision {
    // إيجاد أعلى درجة
    const entries = Object.entries(scores);
    const maxScore = Math.max(...entries.map(([_, s]) => s.score));
    const topType = entries.find(([_, s]) => s.score === maxScore)?.[0];

    // حالة 1: ثقة عالية - لا نحتاج LLM
    if (maxScore >= this.HIGH_CONFIDENCE_THRESHOLD) {
      return {
        shouldUseLLM: false,
        confidence: maxScore,
        reason: 'high_confidence_rule_match',
        fallbackClassification: topType,
      };
    }

    // حالة 2: ثقة متوسطة + سياق قوي - لا نحتاج LLM
    if (maxScore >= this.MEDIUM_CONFIDENCE_THRESHOLD && this.hasStrongContext(ctx)) {
      return {
        shouldUseLLM: false,
        confidence: maxScore,
        reason: 'medium_confidence_strong_context',
        fallbackClassification: topType,
      };
    }

    // حالة 3: ثقة منخفضة - نحتاج LLM
    if (maxScore < this.LOW_CONFIDENCE_THRESHOLD) {
      return {
        shouldUseLLM: true,
        confidence: maxScore,
        reason: 'low_confidence_all_rules',
      };
    }

    // حالة 4: غموض بين عدة أنواع - نحتاج LLM
    const ambiguousTypes = entries
      .filter(([_, s]) => s.score >= maxScore - 1.5)
      .map(([type]) => type);

    if (ambiguousTypes.length >= 2) {
      return {
        shouldUseLLM: true,
        confidence: maxScore,
        reason: `ambiguous_between_${ambiguousTypes.length}_types`,
      };
    }

    // الافتراضي: استخدم LLM للثقة المتوسطة
    return {
      shouldUseLLM: true,
      confidence: maxScore,
      reason: 'medium_confidence_default_llm',
    };
  }

  private hasStrongContext(ctx: LineContext): boolean {
    return ctx.pattern.isInDialogueBlock ||
           ctx.pattern.lastCharacterDistance <= 2 ||
           ctx.pattern.isInSceneHeader;
  }
}

export const preLLMDecisionEngine = new PreLLMDecisionEngine();
1.3 تعديل paste-classifier.ts لاستخدام نظام الثقة
الملف: src/utils/paste-classifier.ts

التغييرات المطلوبة:

إضافة استيراد نظام الثقة:

import { confidenceScorer } from './classification/confidence-scorer';
import { preLLMDecisionEngine } from './classification/pre-llm-decision';
تعديل دالة classifyWithContext (حوالي السطر 640):

// بدلاً من إرجاع { type: string; score: number } بسيط
// نستخدم نظام الثقة المحسّن

const classifyWithContext = (line: string, ctx: LineContext): { type: string; score: number } => {
  // ... التحقق من الأنماط الخاصة (basmala, scene headers, transitions)

  // حساب الثقة لكل نوع محتمل
  const scores = {
    'scene-header-top-line': confidenceScorer.calculateSceneHeaderConfidence(line, ctx),
    'character': confidenceScorer.calculateCharacterConfidence(line, ctx),
    'dialogue': confidenceScorer.calculateDialogueConfidence(line, ctx),
    'action': confidenceScorer.calculateActionConfidence(line, ctx),
    'transition': confidenceScorer.calculateTransitionConfidence(line),
  };

  // اختيار أفضل تصنيف
  let bestType = 'action';
  let bestScore = 0;

  for (const [type, confidence] of Object.entries(scores)) {
    if (confidence.score > bestScore) {
      bestScore = confidence.score;
      bestType = type;
    }
  }

  return { type: bestType, score: bestScore };
};
المرحلة 2: الذاكرة الموحدة والسياق المتدرج
2.1 مدير الذاكرة الموحدة (NEW)
الملف: src/utils/classification/persistent-memory.ts


/**
 * مدير الذاكرة الموحدة - يدعم التخزين المحلي و Firebase
 */

import { ContextMemory } from '@/types/screenplay';

// توسيع واجهة الذاكرة
export interface PersistentMemory extends ContextMemory {
  userId?: string;
  projectId?: string;

  // ذاكرة موسعة
  scenes: {
    known: Array<{ number: string; description: string; firstSeen: number }>;
    currentScene?: string;
  };

  // أنماط التعلم
  patterns: {
    userCorrections: Array<{
      original: string;
      corrected: string;
      line: string;
      timestamp: number;
      confidence: number;
    }>;
    commonTransitions: Array<{ pattern: string; count: number }>;
  };

  // إعدادات المستخدم
  settings: {
    llmThreshold: number;
    autoConfirmThreshold: number;
    learningEnabled: boolean;
  };
}

export class PersistentMemoryManager {
  private storage: Map<string, PersistentMemory> = new Map();
  private readonly localStorageKey = 'filmlane_persistent_memory';

  // تحميل الذاكرة (مع fallback لـ localStorage)
  async load(sessionId: string): Promise<PersistentMemory> {
    // 1. محاولة التحميل من الذاكرة
    if (this.storage.has(sessionId)) {
      return JSON.parse(JSON.stringify(this.storage.get(sessionId)!));
    }

    // 2. محاولة التحميل من localStorage
    try {
      const local = localStorage.getItem(`${this.localStorageKey}_${sessionId}`);
      if (local) {
        return JSON.parse(local);
      }
    } catch (e) {
      console.warn('Failed to load from localStorage:', e);
    }

    // 3. إنشاء ذاكرة جديدة
    return {
      sessionId,
      lastModified: Date.now(),
      data: {
        commonCharacters: [],
        commonLocations: [],
        lastClassifications: [],
        characterDialogueMap: {},
      },
      scenes: { known: [] },
      patterns: { userCorrections: [], commonTransitions: [] },
      settings: {
        llmThreshold: 5.0,
        autoConfirmThreshold: 8.0,
        learningEnabled: true,
      },
    };
  }

  // حفظ الذاكرة
  async save(sessionId: string, memory: PersistentMemory): Promise<void> {
    memory.lastModified = Date.now();
    this.storage.set(sessionId, JSON.parse(JSON.stringify(memory)));

    // حفظ في localStorage أيضاً
    try {
      localStorage.setItem(
        `${this.localStorageKey}_${sessionId}`,
        JSON.stringify(memory)
      );
    } catch (e) {
      console.warn('Failed to save to localStorage:', e);
    }
  }

  // تسجيل تصحيح من المستخدم (للتعلم)
  async recordCorrection(
    sessionId: string,
    line: string,
    originalType: string,
    correctedType: string,
    confidence: number
  ): Promise<void> {
    const memory = await this.load(sessionId);
    memory.patterns.userCorrections.push({
      original: originalType,
      corrected: correctedType,
      line,
      timestamp: Date.now(),
      confidence,
    });
    await this.save(sessionId, memory);
  }

  // الحصول على اقتراحات من التصحيحات السابقة
  async getSuggestions(sessionId: string, line: string): Promise<string[]> {
    const memory = await this.load(sessionId);
    const suggestions: string[] = [];

    // البحث عن تصحيحات مشابهة
    for (const correction of memory.patterns.userCorrections) {
      if (this.isSimilar(line, correction.line)) {
        suggestions.push(correction.corrected);
      }
    }

    return suggestions;
  }

  private isSimilar(line1: string, line2: string): boolean {
    // تشابه بسيط بناءً على الطول والكلمات
    const words1 = new Set(line1.split(/\s+/));
    const words2 = new Set(line2.split(/\s+/));
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    return intersection.size > 0;
  }
}

export const persistentMemoryManager = new PersistentMemoryManager();
2.2 مدير السياق المتدرج (NEW)
الملف: src/utils/classification/sliding-context.ts


/**
 * مدير السياق المتدرج
 * يعالج السيناريو مشهد بمشهد بدلاً من سطر بسطر
 */

import { LineContext } from '@/types/screenplay';

export interface SceneInfo {
  startIndex: number;
  endIndex: number;
  header: string;
}

export class SlidingContextManager {
  private readonly SCENE_HEADER_TYPES = [
    'scene-header-1',
    'scene-header-2',
    'scene-header-3',
    'scene-header-top-line',
  ];

  // تقسيم النص إلى مشاهد
  findSceneBoundaries(lines: string[], types: string[]): SceneInfo[] {
    const scenes: SceneInfo[] = [];
    let currentStart = 0;

    for (let i = 0; i < types.length; i++) {
      if (this.SCENE_HEADER_TYPES.includes(types[i])) {
        if (currentStart < i) {
          scenes.push({
            startIndex: currentStart,
            endIndex: i - 1,
            header: lines[i],
          });
        }
        currentStart = i;
      }
    }

    // إضافة المشهد الأخير
    if (currentStart < lines.length) {
      scenes.push({
        startIndex: currentStart,
        endIndex: lines.length - 1,
        header: lines[currentStart] || '',
      });
    }

    return scenes;
  }

  // بناء سياق موسع لسطر معين
  buildExpandedContext(
    lines: string[],
    types: string[],
    index: number
  ): LineContext {
    // إيجاد حدود المشهد الحالي
    const scenes = this.findSceneBoundaries(lines, types);
    const currentScene = scenes.find(s =>
      index >= s.startIndex && index <= s.endIndex
    );

    // نافذة سياق أكبر داخل المشهد
    const WINDOW_SIZE = 5;
    const sceneStart = currentScene?.startIndex || 0;
    const sceneEnd = currentScene?.endIndex || lines.length;

    const previousLines: string[] = [];
    for (let i = Math.max(sceneStart, index - WINDOW_SIZE); i < index; i++) {
      previousLines.push(lines[i] || '');
    }

    const nextLines: string[] = [];
    for (let i = index + 1; i < Math.min(sceneEnd + 1, index + WINDOW_SIZE + 1); i++) {
      nextLines.push(lines[i] || '');
    }

    // البناء المتبقي مثل buildContext الأصلي
    // (نفس الكود من file:src/utils/paste-classifier.ts:477-557)
    return {
      previousLines,
      currentLine: lines[index] || '',
      nextLines,
      previousTypes: types.slice(0, index),
      stats: {
        wordCount: (lines[index] || '').split(/\s+/).length,
        charCount: (lines[index] || '').length,
        hasColon: (lines[index] || '').includes(':'),
        hasPunctuation: /[.!?،؛]/.test(lines[index] || ''),
        startsWithBullet: /^[•·]/.test(lines[index] || ''),
        isShort: (lines[index] || '').length < 30,
        isLong: (lines[index] || '').length > 100,
      },
      pattern: {
        isInDialogueBlock: types.slice(-3).some(t =>
          ['character', 'dialogue', 'parenthetical'].includes(t)
        ),
        isInSceneHeader: this.SCENE_HEADER_TYPES.includes(types.slice(-1)[0] || ''),
        lastSceneDistance: types.slice().reverse().findIndex(t =>
          this.SCENE_HEADER_TYPES.includes(t)
        ),
        lastCharacterDistance: types.slice().reverse().findIndex(t => t === 'character'),
      },
    };
  }
}

export const slidingContextManager = new SlidingContextManager();
المرحلة 3: تقليل الاعتماد على LLM
3.1 مراجعة LLM بشكل مجمع (MODIFY)
الملف: src/utils/classification/batch-llm-reviewer.ts (NEW)


/**
 * مراجعة LLM بشكل مجمع
 * يجمع الأسطر غير المؤكدة ويراجعها دفعة واحدة
 */

import { AIPayload, AIPatchOp } from '../ai-reviewer';
import { screenplayContentService } from '../screenplay-service';

interface BatchReviewRequest {
  lines: Array<{ id: string; text: string; type: string; score: number }>;
  threshold: number;
}

interface BatchReviewResult {
  reviewed: number;
  skipped: number;
  patches: AIPatchOp[];
}

export class BatchLLMReviewer {
  private readonly DEFAULT_THRESHOLD = 5.0;

  async reviewBatch(request: BatchReviewRequest): Promise<BatchReviewResult> {
    // تصفية الأسطر غير المؤكدة فقط
    const uncertainLines = request.lines.filter(
      line => line.score < request.threshold
    );

    const skippedCount = request.lines.length - uncertainLines.length;

    if (uncertainLines.length === 0) {
      return {
        reviewed: 0,
        skipped: skippedCount,
        patches: [],
      };
    }

    // بناء payload للمراجعة المجمع
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
        reasons: { 'low_confidence': uncertainLines.length },
      },
    };

    // استخدام الخدمة الموجودة
    const patches = await screenplayContentService.reviewContent(payload);

    return {
      reviewed: uncertainLines.length,
      skipped: skippedCount,
      patches,
    };
  }
}

export const batchLLMReviewer = new BatchLLMReviewer();
3.2 تعديل ai-reviewer.ts لاستخدام العتبات (MODIFY)
الملف: src/utils/ai-reviewer.ts

تعديل دالة shouldTriggerReview (حوالي السطر 41):


// إضافة بارامتر threshold
export const shouldTriggerReview = (
  line: string,
  currentType: string,
  score: number,
  ctx: LineContext,
  threshold: number = 5.0 // عتبة قابلة للتكوين
): ReviewTriggerResult => {
  // القاعدة الأساسية: فقط إذا كانت الثقة أقل من العتبة
  if (score >= threshold) {
    return { trigger: false };
  }

  // بقية القواعد الموجودة...
  // (نفس الكود الحالي)
};
المرحلة 4: واجهة المستخدم للتغذية الراجعة
4.1 مكون مؤشر الثقة (NEW)
الملف: src/components/editor/ConfidenceIndicator.tsx


/**
 * مؤشر الثقة - يظهر عند التمرير على السطر
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';

interface ConfidenceIndicatorProps {
  confidence: number;
  show?: boolean;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  show = false,
}) => {
  if (!show) return null;

  // تحديد اللون بناءً على الثقة
  const variant = confidence >= 7 ? 'default' :
                  confidence >= 5 ? 'secondary' :
                  'destructive';

  return (
    <div className="absolute -left-16 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
      <Badge variant={variant} className="text-xs">
        {confidence.toFixed(1)}/10
      </Badge>
    </div>
  );
};
4.2 مكون طلب التصحيح (NEW)
الملف: src/components/editor/CorrectionFeedback.tsx


/**
 * طلب تصحيح التصنيف من المستخدم
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface CorrectionFeedbackProps {
  lineId: string;
  lineText: string;
  currentType: string;
  confidence: number;
  onConfirm: (lineId: string) => void;
  onCorrect: (lineId: string, newType: string) => void;
}

export const CorrectionFeedback: React.FC<CorrectionFeedbackProps> = ({
  lineId,
  lineText,
  currentType,
  confidence,
  onConfirm,
  onCorrect,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(currentType);

  // نظ_formats من ملف الأنواع الموجود
  const formatTypes = [
    { id: 'scene-header-1', label: 'ترويسة مشهد' },
    { id: 'action', label: 'وصف/action' },
    { id: 'character', label: 'شخصية' },
    { id: 'dialogue', label: 'حوار' },
    { id: 'parenthetical', label: 'ملاحظة تمثيل' },
    { id: 'transition', label: 'انتقال' },
  ];

  // إظهار فقط للثقة المنخفضة
  if (confidence > 6) return null;

  return (
    <>
      {/* زر طلب التصحيح */}
      <button
        onClick={() => setOpen(true)}
        className="ml-2 text-yellow-500 hover:text-yellow-600"
        title="طلب تصحيح التصنيف"
      >
        <span className="text-xs">⚠️</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تصحيح التصنيف</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              السطر: "{lineText.substring(0, 50)}..."
            </p>

            <RadioGroup value={selectedType} onValueChange={setSelectedType}>
              {formatTypes.map(format => (
                <div key={format.id} className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value={format.id} id={format.id} />
                  <Label htmlFor={format.id}>{format.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onConfirm(lineId);
                setOpen(false);
              }}
            >
              صحيح (تأكيد)
            </Button>
            <Button
              onClick={() => {
                onCorrect(lineId, selectedType);
                setOpen(false);
              }}
            >
              تصحيح إلى {formatTypes.find(f => f.id === selectedType)?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
4.3 مكون الإعدادات (NEW)
الملف: src/components/editor/ClassificationSettings.tsx


/**
 * إعدادات نظام التصنيف
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';

interface ClassificationSettings {
  llmThreshold: number;
  autoConfirmThreshold: number;
  learningEnabled: boolean;
}

export const ClassificationSettingsDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ClassificationSettings>({
    llmThreshold: 5.0,
    autoConfirmThreshold: 8.0,
    learningEnabled: true,
  });

  const handleSave = () => {
    // حفظ في localStorage
    localStorage.setItem('filmlane_classification_settings', JSON.stringify(settings));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 ml-2" />
          إعدادات التصنيف
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إعدادات التصنيف الذكي</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* حد LLM */}
          <div className="space-y-2">
            <Label>حد استخدام الذكاء الاصطناعي: {settings.llmThreshold}</Label>
            <Slider
              value={[settings.llmThreshold]}
              onValueChange={([v]) => setSettings(s => ({ ...s, llmThreshold: v }))}
              min={0}
              max={10}
              step={0.5}
              className="dir-rtl"
            />
            <p className="text-xs text-muted-foreground">
              استخدم الذكاء الاصطناعي فقط عندما تكون الثقة أقل من هذا الحد
            </p>
          </div>

          {/* حد التأكيد التلقائي */}
          <div className="space-y-2">
            <Label>التأكيد التلقائي: {settings.autoConfirmThreshold}</Label>
            <Slider
              value={[settings.autoConfirmThreshold]}
              onValueChange={([v]) => setSettings(s => ({ ...s, autoConfirmThreshold: v }))}
              min={0}
              max={10}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              لا تطلب تأكيداً عندما تكون الثقة أعلى من هذا الحد
            </p>
          </div>

          {/* التعلم المفعّل */}
          <div className="flex items-center justify-between">
            <Label>التعلم من التصحيحات</Label>
            <Switch
              checked={settings.learningEnabled}
              onCheckedChange={v => setSettings(s => ({ ...s, learningEnabled: v }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave}>حفظ الإعدادات</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
المرحلة 5: API Routes للتعلم والتصحيح
5.1 API للتغذية الراجعة (NEW)
الملف: src/app/api/classification/feedback/route.ts


import { NextResponse } from 'next/server';
import { persistentMemoryManager } from '@/utils/classification/persistent-memory';

export async function POST(request: Request) {
  try {
    const { sessionId, lineId, lineText, originalType, correctedType, confidence } =
      await request.json();

    // تسجيل التصحيح للتعلم
    await persistentMemoryManager.recordCorrection(
      sessionId,
      lineText,
      originalType,
      correctedType,
      confidence
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
5.2 API للإعدادات (NEW)
الملف: src/app/api/classification/settings/route.ts


import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  // يمكن ربطها بـ persistentMemoryManager.settings
  const defaultSettings = {
    llmThreshold: 5.0,
    autoConfirmThreshold: 8.0,
    learningEnabled: true,
  };

  return NextResponse.json(defaultSettings);
}

export async function POST(request: Request) {
  try {
    const settings = await request.json();
    // حفظ الإعدادات
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
خلاصة الملفات المراد تعديلها/إنشاؤها
ملفات جديدة (NEW)
الملف	الغرض
src/utils/classification/confidence-scorer.ts	نظام حساب الثقة
src/utils/classification/pre-llm-decision.ts	محرك قرار ما قبل LLM
src/utils/classification/persistent-memory.ts	مدير الذاكرة الموحدة
src/utils/classification/sliding-context.ts	مدير السياق المتدرج
src/utils/classification/batch-llm-reviewer.ts	مراجعة LLM مجمع
src/components/editor/ConfidenceIndicator.tsx	مؤشر الثقة
src/components/editor/CorrectionFeedback.tsx	طلب التصحيح
src/components/editor/ClassificationSettings.tsx	إعدادات التصنيف
src/app/api/classification/feedback/route.ts	API التغذية الراجعة
src/app/api/classification/settings/route.ts	API الإعدادات
ملفات معدلة (MODIFY)
الملف	التغييرات
src/utils/paste-classifier.ts	دمج نظام الثقة
src/utils/ai-reviewer.ts	إضافة بارامتر threshold
src/components/editor/EditorArea.tsx	إضافة مؤشر الثقة + طلب التصحيح
src/types/screenplay.ts	توسيع واجهات البيانات
خطة التحقق (Verification)
اختبار شامل للنظام
اختبار نظام الثقة:

تأكد أن الترويسات الواضحة تحصل على ثقة ≥ 8
تأكد أن الحوارات بعد character تحصل على ثقة ≥ 7
تأكد أن الأسطر الغامضة تحصل على ثقة < 5
اختبار تقليل LLM:

لصق نص من 100 سطر
تحقق من أن 70%+ تم تصنيفها بدون LLM
تحقق من أن LLM يُستدعى فقط للأسطر منخفضة الثقة
اختبار التعلم:

صحّح تصنيف خاطئ
أعد لصق نفس النص
تحقق من تطبيق التصحيح
اختبار واجهة المستخدم:

تأكد من ظهور مؤشر الثقة عند التمرير
تأكد من ظهور زر التصحيح للثقة المنخفضة
تأكد من حفظ الإعدادات
المتغيرات البيئية المطلوبة
ملف: .env.local


# Firebase (للتخزين المستقبلي)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# AI Server (موجود مسبقاً)
NEXT_PUBLIC_AI_SERVER_URL=http://127.0.0.1:8000
AI_SERVER_API_KEY=local-ai

# إعدادات التصنيف (قيم افتراضية)
NEXT_PUBLIC_DEFAULT_LLM_THRESHOLD=5.0
NEXT_PUBLIC_DEFAULT_AUTO_CONFIRM_THRESHOLD=8.0
NEXT_PUBLIC_LEARNING_ENABLED=true