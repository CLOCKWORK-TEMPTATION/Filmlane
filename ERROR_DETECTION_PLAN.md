# طبقة اكتشاف الأخطاء وتصحيح التصنيفات - Filmlane

## الملخص التنفيذي

بناء طبقة اكتشاف أخطاء (Error Detection Layer) لنظام تصنيف السيناريوهات العربي في Filmlane، تستطيع كشف الأخطاء المحتملة في التصنيفات واقتراح تصحيحات ذكية.

## المشكلة

نظام التصنيف الحالي في `paste-classifier.ts` يستخدم أنماطًا (patterns) لتصنيف عناصر السيناريو، لكنه يفتقر إلى:
- **آلية اكتشاف الأخطاء**: لا يحدد التصنيفات الخاطئة
- **نظام الثقة**: لا يقدم درجات ثقة لكل تصنيف
- **التحقق من السياق**: لا يتحقق من تسلسل العناصر
- **التعامل مع الحالات الشاذة**: الأخطاء الإملائية، التنسيقات غير المتسقة

## الحل المقترح

طبقة برمجية تعمل كـ middleware بين المصنف والمحرر، تكتشف الأخطاء وتقترح تصحيحات.

---

## الملفات الأساسية المطلوب إنشاؤها

### 1. `src/types/validation.ts`
تعريفات الأنواع والواجهات للنظام:
- `ErrorSeverity`: مستويات الخطورة (CRITICAL, HIGH, MEDIUM, LOW, INFO)
- `ErrorCategory`: أنواع الأخطاء (CONTEXT_VIOLATION, CONFIDENCE, ARABIC_SPECIFIC, STRUCTURAL, INCONSISTENCY)
- `ValidationError`: واجهة خطأ التصنيف
- `ValidationResult`: نتيجة فحص المستند
- `ValidationConfig`: إعدادات النظام

### 2. `src/utils/validation-engine.ts`
المحرك الرئيسي الذي ينسق عمليات التحقق:
```typescript
export class ValidationEngine {
  validateDocument(lines, classifications, contextData): ValidationResult
  validateLineChange(line, classification, context, lineNumber): ValidationError
  validateClassifications(lines, classifications): ValidationError[]
  applyCorrection(errorId, suggestionIndex, sessionId): boolean
}
```

### 3. `src/utils/validators/context-validator.ts`
التحقق من انتهاكات السياق:
- Character تليها Character مباشرة
- Dialogue بدون Character سابقة
- Action في منتصف block حواري

### 4. `src/utils/validators/confidence-validator.ts`
حساب درجات الثقة للتصنيفات:
```typescript
calculateActionConfidence(line, context): number
calculateDialogueConfidence(line, context): number
calculateCharacterConfidence(line, context): number
```

### 5. `src/utils/validators/arabic-validator.ts`
التحقق من المشاكل الخاصة باللغة العربية:
- اختلافات التشكيل (diacritics)
- الخلط بين الفصحى والعامية
- مشاكل RTL/LTR
- اختلافات الأرقام (عربية/إنجليزية)

### 6. `src/components/validation/ValidationPanel.tsx`
واجهة المستخدم لعرض الأخطاء والتصحيحات المقترحة

---

## الملفات المطلوب تعديلها

### 1. `src/utils/paste-classifier.ts`
**التغييرات:**
- إضافة `validationHook` بعد التصنيف
- تصدير بيانات الثقة (`confidence scores`)
- إضافة `validationMetadata` إلى نتائج التصنيف

**موقع التغيير الرئيسي:** دالة `handlePaste` - بعد حلقة التصنيف

### 2. `src/components/editor/EditorArea.tsx`
**التغييرات:**
- إضافة `validationState` لإدارة حالة الأخطاء
- إضافة `EditorHandle.triggerValidation()`
- إضافة مؤشرات بصرية للأخطاء (inline highlighting)
- إضافة فئات CSS للأخطاء

### 3. `src/components/editor/ScreenplayEditor.tsx`
**التغييرات:**
- ربط زر "الميكروسكوب" بالتحقق
- إضافة toggle لوحة التح validations

### 4. `src/types/screenplay.ts`
**التغييرات:**
- توسيع `LineContext` بإضافة `validationFlags`

---

## قواعد اكتشاف الأخطاء الرئيسية

### 1. انتهاكات السياق (Context Violations)

| القاعدة | الوصف | الخطورة |
|---------|-------|---------|
| CHAR_AFTER_CHAR | شخصية تتبعها شخصية مباشرة | HIGH |
| DIALOGUE_WITHOUT_CHAR | حوار بدون شخصية سابقة | HIGH |
| ACTION_IN_DIALOGUE | فعل في منتصف block حواري | MEDIUM |
| PARENTHETICAL_WITHOUT_DIALOGUE | بين قوسين خارج سياق الحوار | MEDIUM |

### 2. مشاكل الثقة (Confidence Issues)

| القاعدة | الوصف | العتبة |
|---------|-------|-------|
| LOW_ACTION_CONFIDENCE | مصنف كفعل لكن عليه مؤشرات حوار | < 40% |
| LOW_DIALOGUE_CONFIDENCE | مصنف كحوار لكن عليه مؤشرات فعل | < 40% |
| AMBIGUOUS_CHARACTER | سطر قصير غامض | < 50% |

### 3. مشاكل عربية خاصة (Arabic-Specific)

| القاعدة | الوصف | الخطورة |
|---------|-------|---------|
| INCONSISTENT_DIACRITICS | خلط بين كلمات مشكلة和非مشكلة | LOW |
| MIXED_SCRIPT_WORD | عربي وإنجليزي في كلمة واحدة | HIGH |
| NUMERAL_INCONSISTENCY | خلط الأرقام العربية والإنجليزية | LOW |

---

## خوارزمية حساب الثقة

```typescript
// مثال: حساب ثقة التصنيف كـ Action
function calculateActionConfidence(line, context): number {
  let score = 50;

  // مطابقة النمط (40 نقطة كحد أقصى)
  if (matchesActionStartPattern(line)) score += 25;
  if (isActionVerbStart(line)) score += 20;

  // محاذاة السياق (25 نقطة كحد أقصى)
  if (!context.pattern.isInDialogueBlock) score += 15;

  // جودة المحتوى (20 نقطة كحد أقصى)
  if (context.stats.isLong) score += 15;

  // التناسق (15 نقطة كحد أقصى)
  // التحقق من الذاكرة

  // الخصومات
  if (getDialogueProbability(line) > 5) score -= 30;

  return Math.max(0, Math.min(100, score));
}
```

---

## مراحل التنفيذ

### المرحلة 1: الأساس (الأولوية القصوى)
1. إنشاء `validation.ts` - تعريفات الأنواع
2. إنشاء `validation-engine.ts` - المحرك الرئيسي
3. إنشاء `context-validator.ts` - مدقق السياق
4. إنشاء `confidence-validator.ts` - مدقق الثقة
5. تعديل `paste-classifier.ts` - ربط الـ hook
6. اختبار الوحدة لكل مدقق

### المرحلة 2: المشاكل العربية
1. إنشاء `arabic-validator.ts`
2. إضافة اختبارات للحالات الشاذة العربية
3. اختبار مع سيناريوهات حقيقية من مجلد OSA

### المرحلة 3: واجهة المستخدم
1. إنشاء `ValidationPanel.tsx`
2. إضافة inline highlighting
3. ربط زر الميكروسكوب
4. إضافة tooltips للأخطاء

### المرحلة 4: ميزات متقدمة
1. إنشاء `structural-validator.ts`
2. إنشاء `inconsistency-validator.ts`
3. إضافة auto-fix
4. إنشاء `ValidationDashboard.tsx`

---

## التحقق والاختبار

### اختبار يدوي:
1. افتح Filmlane
2. الصق سيناريو من مجلد OSA
3. اضغط على زر الميكروسكوب
4. تحقق من ظهور الأخطاء في اللوحة
5. جرّب تطبيق تصحيح مقترح

### اختبار آلي:
```bash
npm run test -- validation-engine.test.ts
npm run test -- context-validator.test.ts
npm run test -- confidence-validator.test.ts
```

### سيناريوهات اختبار من OSA:
- سيناريو به "مشهد 1" بدون رقم
- حوار بدون اسم شخصية
- شخصية تتبعها شخصية مباشرة
- خلط التشكيل في نفس السطر

---

## الملفات الحرجة (Critical Files)

هذه أهم 5 ملفات للتنفيذ:

1. **`src/utils/paste-classifier.ts`** - تعديل: إضافة hook التحقق
2. **`src/types/validation.ts`** - إنشاء: تعريفات الأنواع
3. **`src/utils/validation-engine.ts`** - إنشاء: المحرك الرئيسي
4. **`src/utils/validators/confidence-validator.ts`** - إنشاء: مدقق الثقة
5. **`src/components/editor/EditorArea.tsx`** - تعديل: التكامل مع UI

---

## ملاحظات هامة

- النظام سيكون **toggleable** - يمكن تشغيله/إيقافه
- لن يُكسَر أي وظيفة موجودة (non-breaking)
- التنفيذ تدريجي (incremental) - نبدأ بالأساسيات
- استخدام `getDialogueProbability` الموجودة حالياً
- التكامل مع `ContextMemoryManager` الموجود

---

## النتائج المتوقعة

بعد تنفيذ هذه الطبقة:
- ✅ كشف التصنيفات الخاطئة تلقائياً
- ✅ اقتراحات تصحيح ذكية
- ✅ درجات ثقة لكل تصنيف
- ✅ التعامل مع التحديات العربية الخاصة
- ✅ تحسين جودة السيناريوهات المُدخلة
