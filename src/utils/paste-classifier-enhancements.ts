/**
 * =========================
 * 🔧 تحسينات مقترحة لنظام التصنيف
 * =========================
 * 
 * مستخرجة من تحليل 92 ملف سيناريو (10,243 سطر)
 * المصدر: screenplay-patterns-report.md
 */

/**
 * =========================
 * 1. تحسين تطبيع النصوص
 * =========================
 */

/**
 * تطبيع شامل للنص قبل التصنيف
 * يعالج: الرموز الخفية، المسافات حول النقطتين، التشكيل
 */
const normalizeLineEnhanced = (input: string): string => {
  return input
    // إزالة التشكيل
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // إزالة الرموز الخفية (LTR, RTL, BOM)
    .replace(/[\u200f\u200e\ufeff\u061C\t]+/g, '')
    // توحيد المسافات حول النقطتين
    .replace(/\s*[:：]\s*/g, ':')
    // توحيد علامات الاستفهام والتعجب
    .replace(/[؟?]+/g, '؟')
    .replace(/!+/g, '!')
    // إزالة المسافات المتعددة
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * تطبيع خاص لأسماء الشخصيات
 */
const normalizeCharacterName = (input: string): string => {
  return input
    .replace(/[\u200E\u200F\u061C\uFEFF]/g, '')  // رموز خفية
    .replace(/\s+/g, ' ')                         // مسافات متعددة
    .replace(/[:：]+\s*$/g, '')                   // نقطتين في النهاية
    .trim();
};

/**
 * =========================
 * 2. تحسين قواعد عناوين المشاهد
 * =========================
 */

/**
 * أنماط شاملة لعناوين المشاهد
 */
const SCENE_HEADER_PATTERNS = {
  // مشهد 7 ليل-داخلي
  timeLocation: /^\s*مشهد\s*\d+\s*(ليل|نهار|صباح|مساء|فجر)-(داخلي|خارجي)/i,
  
  // مشهد (2/3) أو مشهد 2\3
  fractional: /^\s*مشهد\s*\(?\d+\s*[\\/]\s*\d+\)?/i,
  
  // مشهد12 (فلاش باك)
  withNote: /^\s*مشهد\s*\d+\s*\([^)]+\)/i,
  
  // مشهد 15 - ليل
  withDash: /^\s*مشهد\s*\d+\s*[-–—]\s*(ليل|نهار|صباح|مساء)/i,
  
  // Scene 5 - INT.
  english: /^\s*scene\s*\d+\s*[-–—]?\s*(int|ext|interior|exterior)/i,
};

/**
 * كشف محسّن لعناوين المشاهد
 */
const isSceneHeaderEnhanced = (line: string): boolean => {
  const normalized = normalizeLineEnhanced(line);
  
  // فحص جميع الأنماط
  for (const pattern of Object.values(SCENE_HEADER_PATTERNS)) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  
  // الطريقة الكلاسيكية (احتياطي)
  return isSceneHeader1(line) || isSceneHeader2(line) || isCompleteSceneHeader(line);
};

/**
 * =========================
 * 3. تحسين كشف الانتقالات (Transitions)
 * =========================
 */

/**
 * كلمات الانتقال الشائعة
 */
const TRANSITION_KEYWORDS = new Set([
  // عربي
  'قطع', 'كات', 'اختفاء', 'تحول', 'انتقال',
  'ذوبان', 'ظهور تدريجي', 'اختفاء تدريجي',
  
  // إنجليزي
  'cut', 'fade', 'dissolve', 'wipe',
  'cut to', 'fade in', 'fade out', 'fade to black',
  'dissolve to', 'wipe to', 'smash cut',
]);

/**
 * كشف محسّن للانتقالات
 */
const isTransitionEnhanced = (line: string): boolean => {
  const normalized = normalizeLineEnhanced(line).toLowerCase();
  
  // تفحص الكلمة بأكملها
  const words = normalized.split(/\s+/);
  
  // إذا كانت الكلمة وحدها
  if (words.length === 1 && TRANSITION_KEYWORDS.has(words[0])) {
    return true;
  }
  
  // إذا كانت مع "إلى" (قطع إلى)
  if (words.length === 2 && TRANSITION_KEYWORDS.has(words[0]) && 
      (words[1] === 'إلى' || words[1] === 'to' || words[1] === 'الى')) {
    return true;
  }
  
  // الطريقة القديمة كاحتياطي
  return isTransition(line);
};

/**
 * =========================
 * 4. معالجة الرموز النقطية (Bullets)
 * =========================
 */

/**
 * رموز النقاط الشائعة
 */
const BULLET_SYMBOLS = /^[\s\u200E\u200F\u061C\uFEFF]*[•·∙⋅●○◦■□▪▫◆◇–—−‒―‣⁃*+\-]+\s*/;

/**
 * تحليل ذكي للأسطر التي تبدأ برمز نقطي
 */
const parseBulletLine = (
  line: string
): { type: 'character-dialogue' | 'action'; data?: any } | null => {
  const bulletMatch = line.match(BULLET_SYMBOLS);
  if (!bulletMatch) return null;
  
  const content = line.replace(BULLET_SYMBOLS, '').trim();
  
  // محاولة تحليلها كحوار مباشر (اسم: حوار)
  const inlineParsed = parseInlineCharacterDialogue(content);
  if (inlineParsed) {
    return {
      type: 'character-dialogue',
      data: inlineParsed
    };
  }
  
  // محاولة تحليلها كحوار بدون نقطتين
  const inlineNoColo = parseInlineCharacterDialogueWithoutColon(content);
  if (inlineNoColon) {
    return {
      type: 'character-dialogue',
      data: inlineNoColon
    };
  }
  
  // افتراضياً: action
  return { type: 'action' };
};

/**
 * =========================
 * 5. تحسين كشف الأسطر القصيرة جداً
 * =========================
 */

/**
 * أسئلة قصيرة شائعة في الحوار
 */
const VERY_SHORT_DIALOGUE_PATTERNS = new Set([
  // أسئلة
  'مين', 'فين', 'ايه', 'ازاي', 'ليه', 'إزاي', 'ليش',
  'متى', 'كيف', 'لماذا', 'أين', 'من',
  
  // ردود
  'آه', 'أه', 'لا', 'نعم', 'أيوة', 'ايوه',
  'خلاص', 'طيب', 'ماشي', 'حاضر',
  
  // استفهامات
  'لسه', 'بعدين', 'وبعدين', 'طب',
]);

/**
 * تحسين احتمالية الحوار للأسطر القصيرة
 */
const getDialogueProbabilityEnhanced = (line: string): number => {
  let score = getDialogueProbability(line); // البداية من النقاط الحالية
  
  const normalized = normalizeLineEnhanced(line);
  const firstWord = normalized.split(/\s+/)[0]?.replace(/[؟?!]/g, '');
  
  // أسطر قصيرة جداً تتطابق مع الأنماط الشائعة
  if (VERY_SHORT_DIALOGUE_PATTERNS.has(firstWord)) {
    score += 4;
  }
  
  // سطر قصير جداً (أقل من 10 أحرف) مع علامة استفهام
  if (normalized.length < 10 && /[؟?]/.test(line)) {
    score += 3;
  }
  
  // سطر من كلمة واحدة مع علامة ترقيم
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (wordCount === 1 && /[؟?!،؛]/.test(line)) {
    score += 2;
  }
  
  return score;
};

/**
 * =========================
 * 6. تحسين معالجة Action بالشرطة
 * =========================
 */

/**
 * كشف Action الذي يبدأ بشرطة متبوعة بفعل
 */
const isActionWithDash = (line: string): boolean => {
  const normalized = normalizeLineEnhanced(line);
  
  // شرطة + مسافة + فعل مضارع
  if (/^-\s+[يت][\u0600-\u06FF]{2,}/.test(normalized)) {
    return true;
  }
  
  // شرطة + مسافة + كلمات وصفية مثل "يكتب على الشاشة"
  if (/^-\s+(يكتب|نرى|نسمع|تظهر|يظهر)/.test(normalized)) {
    return true;
  }
  
  return false;
};

/**
 * =========================
 * 7. تحسين Parenthetical المستقل
 * =========================
 */

/**
 * كشف تعليمات الأداء المستقلة
 */
const isStandaloneParenthetical = (
  line: string,
  lastType: string
): boolean => {
  // يجب أن يكون بين أقواس
  if (!/^\s*\([^)]+\)\s*$/.test(line)) {
    return false;
  }
  
  // يجب أن يسبقه character أو dialogue
  if (lastType !== 'character' && lastType !== 'dialogue') {
    return false;
  }
  
  // لا يجب أن يكون طويلاً جداً (أكثر من 50 حرف = جملة)
  const content = line.replace(/[()]/g, '').trim();
  if (content.length > 50) {
    return false;
  }
  
  return true;
};

/**
 * =========================
 * 8. معالجة الحوار بدون نقطتين (متقدم)
 * =========================
 */

/**
 * تحسين parseInlineCharacterDialogueWithoutColon
 * بشروط أكثر صرامة
 */
const parseInlineNoColonEnhanced = (
  line: string
): { characterName: string; dialogueText: string } | null => {
  const trimmed = line.trim();
  
  // لا يحتوي على نقطتين
  if (trimmed.includes(':') || trimmed.includes('：')) {
    return null;
  }
  
  // نمط: اسم (1-3 كلمات) + مسافة + جملة حوارية
  const match = trimmed.match(
    /^([\u0600-\u06FF]{2,}(?:\s+[\u0600-\u06FF]{2,}){0,2})\s+(.+)$/
  );
  
  if (!match) return null;
  
  const [, characterName, dialogueText] = match;
  
  // التحقق من صحة اسم الشخصية
  if (!CHARACTER_RE.test(`${characterName}:`)) {
    return null;
  }
  
  // تجنب أنماط Action
  if (isLikelyAction(trimmed)) {
    return null;
  }
  
  // علامات قوية على الحوار
  const hasStrongDialogueSignal = (
    /[؟?]/.test(dialogueText) ||                           // علامة استفهام
    /\bيا\s+[\u0600-\u06FF]+/.test(dialogueText) ||        // نداء
    /["«»]/.test(dialogueTest) ||                          // اقتباس
    /^(لو|هل|لماذا|ليه|كيف|متى|مين|فين)\b/.test(dialogueText)  // كلمات حوارية
  );
  
  if (!hasStrongDialogueSignal) {
    return null;
  }
  
  return { characterName, dialogueText };
};

/**
 * =========================
 * 9. دالة التصنيف المحسنة الرئيسية
 * =========================
 */

const classifyWithEnhancements = (
  line: string,
  ctx: LineContext
): string => {
  const lastType = ctx.previousTypes[ctx.previousTypes.length - 1];
  
  // 1. Basmala
  if (isBasmala(line)) return 'basmala';
  
  // 2. Scene Headers (محسّن)
  if (isSceneHeaderEnhanced(line)) {
    // تحديد النوع الدقيق
    if (SCENE_HEADER_PATTERNS.timeLocation.test(line)) {
      return 'scene-header-top-line'; // عنوان كامل
    }
    // يمكن تقسيمها للمزيد من الدقة
  }
  
  // 3. Transitions (محسّن)
  if (isTransitionEnhanced(line)) return 'transition';
  
  // 4. Parenthetical (محسّن)
  if (isStandaloneParenthetical(line, lastType)) {
    return 'parenthetical';
  }
  
  // 5. Bullet Lines (جديد)
  if (BULLET_SYMBOLS.test(line)) {
    const bulletResult = parseBulletLine(line);
    if (bulletResult?.type === 'character-dialogue') {
      // معالجة خاصة: قد تحتاج لتقسيم إلى character ثم dialogue
      return 'character'; // أو معالجة أكثر تعقيداً
    }
    return 'action';
  }
  
  // 6. Action with Dash (جديد)
  if (isActionWithDash(line)) return 'action';
  
  // 7. Action Verbs
  if (isLikelyAction(line)) return 'action';
  
  // 8. Character (مع تطبيع محسّن)
  if (isCharacterLine(line, { lastFormat: lastType, isInDialogueBlock: ctx.pattern.isInDialogueBlock })) {
    return 'character';
  }
  
  // 9. Dialogue in Block
  if (ctx.pattern.isInDialogueBlock) {
    if (lastType === 'character' || lastType === 'parenthetical') {
      return 'dialogue';
    }
  }
  
  // 10. Fallback الذكي (محسّن)
  const dialogueScore = getDialogueProbabilityEnhanced(line);
  
  if (dialogueScore >= 3) {
    return 'dialogue';
  }
  
  // Default
  return 'action';
};

/**
 * =========================
 * 📊 ملاحظات التطبيق
 * =========================
 * 
 * 1. يمكن دمج هذه التحسينات تدريجياً
 * 2. اختبار كل تحسين على حدة قبل الدمج
 * 3. قياس التحسن في الدقة بعد كل خطوة
 * 4. الاحتفاظ بالوظائف القديمة كاحتياطي
 * 
 * الأولويات المقترحة للتطبيق:
 * - المرحلة 1: normalizeLineEnhanced + isSceneHeaderEnhanced + isTransitionEnhanced
 * - المرحلة 2: parseBulletLine + isActionWithDash + getDialogueProbabilityEnhanced
 * - المرحلة 3: parseInlineNoColonEnhanced + isStandaloneParenthetical
 */

export {
  normalizeLineEnhanced,
  normalizeCharacterName,
  isSceneHeaderEnhanced,
  isTransitionEnhanced,
  parseBulletLine,
  isActionWithDash,
  getDialogueProbabilityEnhanced,
  isStandaloneParenthetical,
  parseInlineNoColonEnhanced,
  classifyWithEnhancements,
};
