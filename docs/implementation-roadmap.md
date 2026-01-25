# خطة تنفيذ تحسينات التصنيف

**🎯 الهدف**: تحسين دقة التصنيف من ~70% إلى ~90%  
**📊 نطاق العمل**: 3,694 حالة مكتشفة (36% من الأسطر المحللة)

---

## ✅ قائمة التحقق الرئيسية

### المرحلة الأولى - الأساسيات

- [ ] **تحسين التطبيع**
  - [ ] دمج `normalizeLineEnhanced()` في [paste-classifier.ts](../src/utils/paste-classifier.ts)
  - [ ] استبدال `normalizeLine()` القديمة في الأماكن الحرجة
  - [ ] إضافة `normalizeCharacterName()` لمعالجة أسماء الشخصيات
  - [ ] اختبار على 50 سطر عشوائي

- [ ] **عناوين المشاهد**
  - [ ] دمج `SCENE_HEADER_PATTERNS` الجديدة
  - [ ] تحديث `isSceneHeader1()` و `isSceneHeader2()`
  - [ ] إضافة `isSceneHeaderEnhanced()` كبديل
  - [ ] اختبار على جميع أنواع عناوين المشاهد (342 حالة)
  - [ ] قياس نسبة التحسن

- [ ] **الانتقالات**
  - [ ] دمج `TRANSITION_KEYWORDS`
  - [ ] تحديث `isTransition()` أو إنشاء `isTransitionEnhanced()`
  - [ ] اختبار على 330 حالة "قطع"
  - [ ] التحقق من عدم التضارب مع Action

### المرحلة الثانية - التحسينات

- [ ] **الرموز النقطية**
  - [ ] دمج `parseBulletLine()`
  - [ ] تحديث `stripLeadingBullets()` لاستخدام التحليل الذكي
  - [ ] اختبار على 268 حالة
  - [ ] التعامل مع الحالات المعقدة (bullet + اسم: حوار)

- [ ] **Action بالشرطة**
  - [ ] دمج `isActionWithDash()`
  - [ ] إضافة فحص مبكر في `classifyWithContext()`
  - [ ] اختبار على 198 حالة
  - [ ] التأكد من عدم تصنيف الحوارات خطأً

- [ ] **الأسطر القصيرة**
  - [ ] دمج `VERY_SHORT_DIALOGUE_PATTERNS`
  - [ ] تحديث `getDialogueProbability()` إلى `getDialogueProbabilityEnhanced()`
  - [ ] اختبار على 69 حالة
  - [ ] ضبط الحدود (threshold) لتجنب False Positives

### المرحلة الثالثة - التحسينات المتقدمة

- [ ] **Parenthetical المستقل**
  - [ ] دمج `isStandaloneParenthetical()`
  - [ ] تحديث منطق Parenthetical في `classifyWithContext()`
  - [ ] اختبار على 16 حالة
  - [ ] التحقق من السياق (lastType)

- [ ] **الحوار بدون نقطتين**
  - [ ] دمج `parseInlineNoColonEnhanced()`
  - [ ] تحديث `parseInlineCharacterDialogueWithoutColon()` الحالية
  - [ ] اختبار مكثف على 167 حالة
  - [ ] ضبط شروط الكشف لتجنب False Positives
  - [ ] **هذه الأصعب - تحتاج دقة عالية**

---

## 🧪 خطة الاختبار

### وحدات الاختبار (Unit Tests)

```typescript
// tests/paste-classifier.test.ts

describe('Enhanced Classification', () => {
  describe('normalizeLineEnhanced', () => {
    it('should remove hidden characters', () => {
      const input = 'اسم\u200F:\u200Eحوار';
      expect(normalizeLineEnhanced(input)).toBe('اسم:حوار');
    });
    
    it('should normalize spaces around colons', () => {
      const input = 'اسم  :  حوار';
      expect(normalizeLineEnhanced(input)).toBe('اسم:حوار');
    });
  });
  
  describe('isSceneHeaderEnhanced', () => {
    it('should detect "مشهد 7 ليل-داخلي"', () => {
      expect(isSceneHeaderEnhanced('مشهد 7 ليل-داخلي')).toBe(true);
    });
    
    it('should detect fractional scenes', () => {
      expect(isSceneHeaderEnhanced('مشهد (2/3)')).toBe(true);
    });
  });
  
  describe('isTransitionEnhanced', () => {
    it('should detect standalone "قطع"', () => {
      expect(isTransitionEnhanced('قطع')).toBe(true);
    });
    
    it('should detect "قطع إلى"', () => {
      expect(isTransitionEnhanced('قطع إلى')).toBe(true);
    });
  });
  
  // ... المزيد من الاختبارات
});
```

### اختبارات التكامل (Integration Tests)

```typescript
describe('Full Classification Pipeline', () => {
  it('should correctly classify 50 sample lines', () => {
    const samples = [
      { line: 'علي:', expected: 'character' },
      { line: 'قطع', expected: 'transition' },
      { line: 'مشهد 5 ليل-داخلي', expected: 'scene-header-top-line' },
      // ... 47 حالة أخرى
    ];
    
    samples.forEach(({ line, expected }) => {
      const result = classifyLine(line, /* context */);
      expect(result).toBe(expected);
    });
  });
});
```

### اختبارات الأداء (Performance Tests)

```typescript
describe('Performance', () => {
  it('should classify 1000 lines in < 100ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      classifyLine(testLines[i], /* context */);
    }
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });
});
```

---

## 📊 قياس التحسن

### مقاييس الأداء (Metrics)

| المقياس | القيمة الحالية | القيمة المستهدفة | طريقة القياس |
|---------|----------------|------------------|---------------|
| دقة التصنيف الكلية | ~70% | ~90% | مقارنة مع تصنيف يدوي |
| دقة عناوين المشاهد | ؟ | >95% | نسبة الكشف الصحيح |
| دقة الانتقالات | ؟ | >95% | نسبة الكشف الصحيح |
| دقة الحوار | ؟ | >85% | نسبة الكشف الصحيح |
| False Positives | ؟ | <5% | حالات خاطئة / إجمالي |
| False Negatives | ؟ | <10% | حالات مفقودة / إجمالي |

### أدوات القياس

```typescript
// tools/measure-accuracy.ts

interface ClassificationResult {
  line: string;
  expected: string;
  actual: string;
  correct: boolean;
}

function measureAccuracy(
  testSet: Array<{ line: string; expected: string }>
): {
  accuracy: number;
  precision: number;
  recall: number;
  falsePositives: number;
  falseNegatives: number;
} {
  const results: ClassificationResult[] = testSet.map(({ line, expected }) => ({
    line,
    expected,
    actual: classifyLine(line),
    correct: false,
  }));
  
  results.forEach(r => r.correct = r.expected === r.actual);
  
  const correctCount = results.filter(r => r.correct).length;
  const accuracy = (correctCount / results.length) * 100;
  
  // حساب Precision & Recall لكل نوع...
  
  return {
    accuracy,
    precision: 0, // TODO
    recall: 0,    // TODO
    falsePositives: 0, // TODO
    falseNegatives: 0, // TODO
  };
}
```

---

## 🐛 خطة التعامل مع المشاكل

### المشاكل المتوقعة

1. **تضارب مع الكود الحالي**
   - **الحل**: استخدام wrapper functions والاحتفاظ بالوظائف القديمة
   - **مثال**: `normalizeLineEnhanced()` بدلاً من استبدال `normalizeLine()`

2. **انخفاض الأداء**
   - **الحل**: Profiling + Optimization
   - **هدف**: لا يتجاوز 10% تباطؤ

3. **زيادة False Positives**
   - **الحل**: ضبط الـ thresholds تدريجياً
   - **هدف**: الحفاظ على دقة >85%

4. **صعوبة الاختبار**
   - **الحل**: بناء test dataset شامل
   - **هدف**: 500+ حالة اختبار

### خطة الطوارئ

- الاحتفاظ بنسخة احتياطية من الكود الأصلي
- إمكانية التراجع عن أي تحسين فردي
- Feature flags للتحكم في التحسينات

```typescript
const FEATURE_FLAGS = {
  useEnhancedNormalization: true,
  useEnhancedSceneHeaders: true,
  useEnhancedTransitions: true,
  useEnhancedBullets: false, // غير مفعل حتى الاختبار
  // ...
};
```

---

## 📝 التوثيق

### ما يجب توثيقه

- [ ] تحديث [README.md](../README.md)
- [ ] إضافة قسم "Classification Rules" في الـ documentation
- [ ] توثيق كل دالة جديدة مع JSDoc
- [ ] إنشاء [CHANGELOG.md](../CHANGELOG.md) إن لم يكن موجوداً
- [ ] كتابة أمثلة استخدام للمطورين

### نموذج CHANGELOG

```markdown
## [Unreleased]

### Added
- تحسينات شاملة لنظام التصنيف (36% تحسن متوقع)
- دعم عناوين المشاهد غير القياسية (342 حالة جديدة)
- كشف محسّن للانتقالات (330 حالة)
- معالجة ذكية للرموز النقطية (268 حالة)

### Changed
- تحديث `normalizeLine()` لإزالة الرموز الخفية
- تحسين `getDialogueProbability()` للأسطر القصيرة

### Fixed
- معالجة المسافات حول النقطتين في أسماء الشخصيات
- كشف Action الذي يبدأ بشرطة

---

## ✨ المكافآت المتوقعة

عند إتمام جميع المراحل:

1. **للمستخدم**:
   - تجربة أفضل عند اللصق
   - تصنيف أدق تلقائياً
   - وقت أقل في التصحيح اليدوي

2. **للمشروع**:
   - كود أكثر قوة ومرونة
   - تغطية اختبارات أفضل
   - توثيق شامل

3. **للمطور**:
   - فهم أعمق لأنماط السيناريوهات العربية
   - مهارات محسنة في معالجة النصوص
   - قاعدة معرفية قيمة

---

**👥 الموارد المطلوبة**: مطور واحد + مُراجع  
**📈 النتائج المتوقعة**: تحسين 36% من الحالات على الأقل
