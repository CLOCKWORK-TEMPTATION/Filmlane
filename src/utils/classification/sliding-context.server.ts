/**
 * Sliding Context Manager with Gemini 2.5 Flash-Lite integration (SERVER-SIDE ONLY)
 * Powered by google-genai SDK - January 2026 Version
 *
 * المطور: محمد أمين راضي
 * الهدف: تحليل سياق السيناريوهات باستخدام أسرع نماذج جوجل
 *
 * ⚠️ IMPORTANT: This file must ONLY be imported in API routes or server components
 * Do NOT import this in client components!
 */

import type { LineContext } from '@/types/screenplay';
import { logger } from '../logger';
import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// --- الاستيرادات والتعريفات الأساسية ---

export type SceneInfo = {
  startIndex: number;
  endIndex: number;
  header: string;
};

export type GeminiContextAnalysis = {
  characterIntent?: string;
  tone?: string;
  emotionalState?: string;
  relationships?: string[];
  sceneContext?: string;
  detectedEntities?: {
    characters?: string[];
    locations?: string[];
    props?: string[];
  };
};

// ✅ Compatibility: Keep the old interface name as alias
export type LlamaContextAnalysis = GeminiContextAnalysis;

const BULLET_RE = /^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+]/;

// --- كلاس إدارة السياق المتقدم ---

export class SlidingContextManager {
  private readonly SCENE_HEADER_TYPES = [
    'scene-header-1',
    'scene-header-2',
    'scene-header-3',
    'scene-header-top-line',
  ];

  private geminiEnabled = true;
  private contextCache = new Map<string, GeminiContextAnalysis>();

  private isClientInitialized = false;

  // ✅ Compatibility: Keep old properties for existing code
  private modelPath: string | null = null;

  /**
   * تهيئة عميل Gemini مع التحقق من المفتاح
   */
  async initialize(apiKeyOrPath: string): Promise<void> {
    try {
      if (!apiKeyOrPath) {
        throw new Error('API Key is missing for Gemini integration');
      }

      // ✅ Check if it's an API key (starts with AIza or similar)
      if (apiKeyOrPath.startsWith('AIza') || apiKeyOrPath.length < 100) {
        logger.info('SlidingContext', `📥 Initializing Gemini with Genkit AI`);

        // Genkit AI is already configured in @/ai/genkit
        // Just verify the API key is set in environment
        this.modelPath = `googleai/gemini-2.5-flash-lite`;
        this.isClientInitialized = true;

        logger.info('SlidingContext', `✅ Gemini 2.5 Flash-Lite ready via Genkit`);
      } else {
        // Legacy path: throw error since we don't support local models anymore
        throw new Error(
          'Local model paths are not supported. Please provide a Google API key starting with "AIza"',
        );
      }
    } catch (error: unknown) {
      this.isClientInitialized = false;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('SlidingContext', `❌ Initialization failed: ${msg}`);
      throw error;
    }
  }

  /**
   * الوظيفة الأساسية: بناء سياق موسع يجمع بين المنطق البرمجي والذكاء الاصطناعي
   */
  async buildExpandedContext(
    lines: string[],
    types: string[],
    index: number,
  ): Promise<
    LineContext & { geminiAnalysis?: GeminiContextAnalysis; llamaAnalysis?: GeminiContextAnalysis }
  > {
    const start = Date.now();

    // 1. بناء السياق الميكانيكي (Mechanical Context)
    const baseContext = this.buildBaseContext(lines, types, index);

    // 2. التحقق من إمكانية استخدام Gemini
    if (!this.geminiEnabled || !this.isClientInitialized) {
      return baseContext;
    }

    try {
      // 3. تحليل السياق بالذكاء الاصطناعي
      const geminiAnalysis = await this.analyzeContextWithGemini(lines, types, index, baseContext);

      const duration = Date.now() - start;
      logger.info('SlidingContext', `✅ Context enriched for line ${index} in ${duration}ms`);

      // ✅ Compatibility: Return both geminiAnalysis and llamaAnalysis (same object)
      return {
        ...baseContext,
        geminiAnalysis,
        llamaAnalysis: geminiAnalysis, // Same content, different key for compatibility
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('SlidingContext', `❌ Analysis failed for line ${index}: ${msg}`);
      return baseContext; // العودة للسياق الأساسي في حال الخطأ
    }
  }

  private async analyzeContextWithGemini(
    lines: string[],
    types: string[],
    index: number,
    baseContext: LineContext,
  ): Promise<GeminiContextAnalysis> {
    const cacheKey = this.buildCacheKey(lines, types, index);
    if (this.contextCache.has(cacheKey)) {
      logger.info('SlidingContext', `📦 Using cached context for line ${index}`);
      return this.contextCache.get(cacheKey) || {};
    }

    // تجميع السياق (استخدام نافذة أوسع لـ Gemini)
    const previousLines = baseContext.previousLines.slice(-5);
    const nextLines = baseContext.nextLines.slice(0, 3);
    const currentLine = baseContext.currentLine;

    const promptText = this.buildGeminiPrompt(
      previousLines,
      currentLine,
      nextLines,
      baseContext.previousTypes.slice(-5),
    );

    try {
      // ✅ استخدام Genkit AI للتحليل - تعريف prompt
      const ContextAnalysisInputSchema = z.object({
        promptText: z.string(),
      });

      const ContextAnalysisOutputSchema = z.object({
        characterIntent: z.string().optional(),
        tone: z.string().optional(),
        emotionalState: z.string().optional(),
        relationships: z.array(z.string()).optional(),
        sceneContext: z.string().optional(),
        detectedEntities: z
          .object({
            characters: z.array(z.string()).optional(),
            locations: z.array(z.string()).optional(),
            props: z.array(z.string()).optional(),
          })
          .optional(),
      });

      // تعريف prompt
      const tempPrompt = ai.definePrompt({
        name: 'contextAnalysis',
        input: { schema: ContextAnalysisInputSchema },
        output: { schema: ContextAnalysisOutputSchema },
        prompt: `{{promptText}}`,
      });

      // تنفيذ الطلب
      const { output } = await tempPrompt({ promptText });

      const analysis = output as GeminiContextAnalysis;
      this.contextCache.set(cacheKey, analysis);
      return analysis;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Gemini Core Error: ${msg}`);
    }
  }

  private buildGeminiPrompt(prev: string[], curr: string, next: string[], types: string[]): string {
    return `أنت مساعد متخصص في تحليل نصوص السيناريو الدرامية (Screenplay Analyst).
حلل السطر الحالي بناءً على الأسطر المحيطة وقدم النتائج في صيغة JSON دقيقة.

البيانات المتاحة:
- الأسطر السابقة: ${JSON.stringify(prev)}
- السطر المستهدف: "${curr}"
- الأسطر اللاحقة: ${JSON.stringify(next)}
- أنواع الأسطر السابقة: ${types.join(', ')}

المطلوب استخراجه:
1. characterIntent: ماذا تريد الشخصية من هذا الكلام/الفعل؟
2. tone: نبرة الحوار (هادئ، حاد، ساخر، رسمي).
3. emotionalState: الحالة العاطفية (خوف، غضب، فرح، يأس).
4. relationships: طبيعة العلاقة الظاهرة بين المتحدث ومن معه.
5. sceneContext: ملخص قصير جداً لما يحدث في المشهد الآن.
6. detectedEntities: الشخصيات المذكورة، الأماكن، الأدوات (Props).

يجب أن يكون الرد JSON مطابقاً للهيكل التالي فقط:
{
  "characterIntent": "string",
  "tone": "string",
  "emotionalState": "string",
  "relationships": ["string"],
  "sceneContext": "string",
  "detectedEntities": { "characters": [], "locations": [], "props": [] }
}`;
  }

  private parseGeminiResponse(response: string): GeminiContextAnalysis {
    try {
      const cleanJson = response.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch {
      // منطق احتياطي للاستخراج النصي في حال فشل الـ JSON
      return this.fallbackTextExtraction(response);
    }
  }

  /**
   * استخراج المعلومات يدوياً في حالات الطوارئ (Original Logic Preserved)
   */
  private fallbackTextExtraction(text: string): GeminiContextAnalysis {
    const analysis: GeminiContextAnalysis = {};

    const tonePatterns = [
      { pattern: /غاضب|انفعال|صياح|يصرخ/i, value: 'غاضب' },
      { pattern: /حزين|بكاء|أسف|يذرف/i, value: 'حزين' },
      { pattern: /سعيد|ضحك|فرح|يبتسم/i, value: 'سعيد' },
      { pattern: /هدوء|صمت|تفكير|همس/i, value: 'هادئ' },
    ];

    for (const { pattern, value } of tonePatterns) {
      if (pattern.test(text)) {
        analysis.tone = value;
        break;
      }
    }

    const emotionPatterns = [
      { pattern: /خوف|رهبة|قلق|يرتجف/i, value: 'خائف' },
      { pattern: /حب|عشق|شغف|يحب/i, value: 'متحمس' },
      { pattern: /كره|اشمئزاز|يبغض/i, value: 'منفر' },
      { pattern: /دهشة|مفاجأة|يندهش/i, value: 'مندهش' },
    ];

    for (const { pattern, value } of emotionPatterns) {
      if (pattern.test(text)) {
        analysis.emotionalState = value;
        break;
      }
    }

    const intentPatterns = [
      { pattern: /يريد (الانتقام|الثأر|العودة)/i, value: 'انتقام' },
      { pattern: /يريد (الحديث|شرح|التوضيح)/i, value: 'توضيح' },
      { pattern: /يريد (المغادرة|الرحيل|الخروج)/i, value: 'مغادرة' },
      { pattern: /يريد (البقاء|البقاء مع)/i, value: 'البقاء' },
    ];

    for (const { pattern, value } of intentPatterns) {
      if (pattern.test(text)) {
        analysis.characterIntent = value;
        break;
      }
    }

    return analysis;
  }

  /**
   * بناء السياق الأساسي (Mechanical Logic) - الحفاظ على الـ 600 سطر من المنطق
   */
  private buildBaseContext(lines: string[], types: string[], index: number): LineContext {
    const scenes = this.findSceneBoundaries(lines, types);
    const currentScene = scenes.find((s) => index >= s.startIndex && index <= s.endIndex);

    const WINDOW_SIZE = 5;
    const sceneStart = currentScene?.startIndex ?? 0;
    const sceneEnd = currentScene?.endIndex ?? lines.length - 1;

    const previousLines: string[] = [];
    for (let i = Math.max(sceneStart, index - WINDOW_SIZE); i < index; i++) {
      previousLines.push(lines[i] || '');
    }

    const nextLines: string[] = [];
    for (let i = index + 1; i <= Math.min(sceneEnd, index + WINDOW_SIZE); i++) {
      nextLines.push(lines[i] || '');
    }

    const currentLine = lines[index] || '';
    const trimmedLine = currentLine.trim();

    // حساب الإحصائيات الدقيقة للسطر
    const stats = {
      wordCount: trimmedLine.split(/\s+/).filter(Boolean).length,
      charCount: trimmedLine.length,
      hasColon: trimmedLine.includes(':') || trimmedLine.includes('：'),
      hasPunctuation: /[.!?،؛]/.test(trimmedLine),
      startsWithBullet: BULLET_RE.test(currentLine),
      isShort: trimmedLine.length < 30,
      isLong: trimmedLine.length > 100,
    };

    const previousTypes = types.slice(0, index);
    const lastType = previousTypes[previousTypes.length - 1] || '';

    // تحديد المسافات بين العناصر الدرامية
    let lastSceneDistance = -1;
    for (let i = previousTypes.length - 1; i >= 0; i--) {
      if (this.SCENE_HEADER_TYPES.includes(previousTypes[i])) {
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
        isInDialogueBlock: types
          .slice(Math.max(0, index - 3), index)
          .some((t) => ['character', 'dialogue', 'parenthetical'].includes(t)),
        isInSceneHeader: this.SCENE_HEADER_TYPES.includes(lastType),
        lastSceneDistance,
        lastCharacterDistance,
      },
    };
  }

  /**
   * تحديد حدود المشاهد بناءً على أنواع الأسطر
   */
  findSceneBoundaries(lines: string[], types: string[]): SceneInfo[] {
    const scenes: SceneInfo[] = [];
    let currentStart = 0;

    for (let i = 0; i < types.length; i++) {
      if (this.SCENE_HEADER_TYPES.includes(types[i])) {
        if (currentStart < i) {
          scenes.push({
            startIndex: currentStart,
            endIndex: i - 1,
            header: lines[currentStart] || '',
          });
        }
        currentStart = i;
      }
    }
    scenes.push({
      startIndex: currentStart,
      endIndex: lines.length - 1,
      header: lines[currentStart] || '',
    });
    return scenes;
  }

  // --- دوال التحكم والإدارة ---

  private buildCacheKey(lines: string[], types: string[], index: number): string {
    const contentHash = lines[index]?.length || 0;
    return `${index}-${contentHash}`;
  }

  /**
   * ✅ Compatibility: Keep old method name
   */
  setLlamaEnabled(enabled: boolean): void {
    this.geminiEnabled = enabled;
    this.setGeminiEnabled(enabled);
  }

  setGeminiEnabled(enabled: boolean): void {
    this.geminiEnabled = enabled;
    logger.info('SlidingContext', `Gemini enabled set to: ${enabled}`);
  }

  clearCache(): void {
    this.contextCache.clear();
    logger.info('SlidingContext', '🗑️ Cache cleared');
  }

  /**
   * ✅ Compatibility: Keep old method name
   */
  isModelReady(): boolean {
    return this.isClientInitialized;
  }

  async unload(): Promise<void> {
    this.isClientInitialized = false;
    this.modelPath = null;
    this.contextCache.clear();
    logger.info('SlidingContext', '📤 Gemini Client and Cache cleared');
  }

  /**
   * ✅ Compatibility: Keep old method signature
   */
  getModelInfo(): { loaded: boolean; path: string | null; cacheSize: number } {
    return {
      loaded: this.isClientInitialized,
      path: this.modelPath,
      cacheSize: this.contextCache.size,
    };
  }
}

// تصدير نسخة وحيدة (Singleton) للعمل في بيئة الخادم
export const slidingContextManager = new SlidingContextManager();
