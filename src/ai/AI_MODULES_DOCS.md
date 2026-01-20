# توثيق وحدات الذكاء الاصطناعي (AI Modules Documentation)

## نظرة عامة
هذا الملف يوثق جميع وحدات الذكاء الاصطناعي في مشروع Filmlane. تستخدم هذه الوحدات إطار عمل Google Genkit لتوفير وظائف ذكاء اصطناعي للمحرر.

---

## هيكل المجلد
```
src/ai/
├── genkit.ts                        # إعدادات Genkit الرئيسية
├── dev.ts                           # ملف التطوير والاستيراد
└── flows/
    ├── auto-format-screenplay.ts    # تنسيق السيناريو تلقائياً
    └── generate-scene-ideas.ts      # توليد أفكار للمشاهد
```

---

## 1. genkit.ts
**المسار:** [src/ai/genkit.ts](src/ai/genkit.ts)

**الدور:** إعدادات Genkit الرئيسية وتهيئة نموذج الذكاء الاصطناعي.

### الواردات (Imports)
```typescript
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
```
- **genkit:** إطار عمل Google لإنشاء تطبيقات الذكاء الاصطناعي
- **googleAI:** موصّل Google AI لاستخدام نماذج Gemini

### التهيئة (Configuration)
```typescript
export const ai = genkit({
  plugins: [googleAI()],              // تفعيل موصّل Google AI
  model: 'googleai/gemini-2.5-flash', // استخدام نموذج Gemini 2.5 Flash
});
```

**التفصيل سطر بسطر:**
- **السطر 4:** إنشاء مثيل Genkit وتصديره للاستخدام في التطبيق
- **السطر 5:** إضافة موصّل Google AI كإضافة (plugin)
- **السطر 6:** تحديد نموذج Gemini 2.5 Flash كنموذج افتراضي (سريع وفعال)

---

## 2. dev.ts
**المسار:** [src/ai/dev.ts](src/ai/dev.ts)

**الدور:** ملف التطوير الذي يستورد جميع دوال الذكاء الاصطناعي لتسجيلها في Genkit.

### الواردات (Imports)
```typescript
import { config } from 'dotenv';
config();

import '@/ai/flows/auto-format-screenplay.ts';
import '@/ai/flows/generate-scene-ideas.ts';
```

**التفصيل سطر بسطر:**
- **السطر 1:** استيراد دالة config من dotenv
- **السطر 2:** تحميل متغيرات البيئة من ملف .env
- **السطر 4:** استيراد دالة تنسيق السيناريو (يسجلها في Genkit)
- **السطر 5:** استيراد دالة توليد الأفكار (يسجلها في Genkit)

**ملاحظة:** هذا الملف يستخدم عادة في مرحلة التطوير لتشغيل Genkit CLI واختبار الدوال.

---

## 3. auto-format-screenplay.ts
**المسار:** [src/ai/flows/auto-format-screenplay.ts](src/ai/flows/auto-format-screenplay.ts)

**الدور:** تنسيق النص الخام إلى سيناريو منسق بشكل احترافي باستخدام الذكاء الاصطناعي.

### الواردات (Imports)
```typescript
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
```
- **ai:** مثيل Genkit المُهيأ
- **z:** مكتبة Zod لتعريف المخططات (schemas)

### المخططات (Schemas)

#### AutoFormatScreenplayInputSchema
**السطر:** 14-16
```typescript
const AutoFormatScreenplayInputSchema = z.object({
  rawText: z.string().describe('The raw screenplay text to format.'),
});
```
- **السطر 14:** تعريف مخطط الإدخال ككائن
- **السطر 15:** تحديد حقل rawText كنص مع وصفه
- **السطر 16:** إغلاق المخطط

#### AutoFormatScreenplayOutputSchema
**السطر:** 19-21
```typescript
const AutoFormatScreenplayOutputSchema = z.object({
  formattedScreenplay: z.string().describe('The screenplay formatted with proper scene headings, character names, and dialogue.'),
});
```
- **السطر 19:** تعريف مخطط الإخراج ككائن
- **السطر 20:** تحديد حقل formattedScreenplay كنص مع وصفه
- **السطر 21:** إغلاق المخطط

### الأنواع (Types)
**السطر 17 و 22:** تصدير أنواع TypeScript المُستنبطة من المخططات
```typescript
export type AutoFormatScreenplayInput = z.infer<typeof AutoFormatScreenplayInputSchema>;
export type AutoFormatScreenplayOutput = z.infer<typeof AutoFormatScreenplayOutputSchema>;
```

### الدوال (Functions)

#### autoFormatScreenplay(input: AutoFormatScreenplayInput): Promise<AutoFormatScreenplayOutput>
**السطر:** 24-26
**الدور:** الوظيفة الرئيسية المُصدرة لتنسيق السيناريو
**التفصيل:**
- **السطر 24:** تعريف الدالة كـ async وتصديرها
- **السطر 25:** استدعاء التدفق (flow) الداخلي وإرجاع النتيجة
- **السطر 26:** إغلاق الدالة

#### prompt
**السطر:** 28-44
**الدور:** تعريف prompt للذكاء الاصطناعي
**التفصيل:**
- **السطر 28:** تعريف prompt باستخدام ai.definePrompt
- **السطر 29:** تعيين اسم الـ prompt
- **السطر 30:** تحديد مخطط الإدخال
- **السطر 31:** تحديد مخطط الإخراج
- **السطر 32:** بداية نص الـ prompt
- **السطر 33-42:** تعليمات التنسيق للذكاء الاصطناعي
  - رؤوس المشاهد (Scene Headings)
  - أسماء الشخصيات (Character Names)
  - الحوار (Dialogue)
  - الإجراء (Action)
  - التعليقات بين قوسين (Parentheticals)
  - الانتقالات (Transitions)
- **السطر 43:** إدراج النص الخام في الـ prompt باستخدام {{{rawText}}}
- **السطر 44:** إغلاق تعريف الـ prompt

#### autoFormatScreenplayFlow
**السطر:** 46-56
**الدور:** تدفق (flow) Genkit الذي ينفذ عملية التنسيق
**التفصيل:**
- **السطر 46:** تعريف التدفق باستخدام ai.defineFlow
- **السطر 47-50:** إعدادات التدفق (الاسم، الإدخال، الإخراج)
- **السطر 52:** بداية الدالة المُنفذة للتدفق
- **السطر 53:** استدعاء الـ prompt مع الإدخال والحصول على النتيجة
- **السطر 54:** إرجاع الإخراج فقط (مع ! للتأكد من عدم وجود undefined)
- **السطر 55:** إغلاق الدالة
- **السطر 56:** إغلاق تعريف التدفق

---

## 4. generate-scene-ideas.ts
**المسار:** [src/ai/flows/generate-scene-ideas.ts](src/ai/flows/generate-scene-ideas.ts)

**الدور:** توليد أفكار للمشاهد بناءً على موضوع أو ملخص باستخدام الذكاء الاصطناعي.

### الواردات (Imports)
```typescript
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
```

### المخططات (Schemas)

#### GenerateSceneIdeasInputSchema
**السطر:** 14-16
```typescript
const GenerateSceneIdeasInputSchema = z.object({
  theme: z.string().describe('The theme or short summary to base scene ideas on.'),
});
```
- **السطر 14:** تعريف مخطط الإدخال ككائن
- **السطر 15:** تحديد حقل theme كنص مع وصفه
- **السطر 16:** إغلاق المخطط

#### GenerateSceneIdeasOutputSchema
**السطر:** 19-22
```typescript
const GenerateSceneIdeasOutputSchema = z.object({
  sceneIdeas: z.array(z.string()).describe('An array of scene ideas.'),
  progress: z.string().describe('A one-sentence summary of what was generated.')
});
```
- **السطر 19:** تعريف مخطط الإخراج ككائن
- **السطر 20:** تحديد حقل sceneIdeas كمصفوفة من النصوص
- **السطر 21:** تحديد حقل progress كنص (ملخص جملة واحدة)
- **السطر 22:** إغلاق المخطط

### الأنواع (Types)
**السطر 17 و 23:** تصدير أنواع TypeScript المُستنبطة

### الدوال (Functions)

#### generateSceneIdeas(input: GenerateSceneIdeasInput): Promise<GenerateSceneIdeasOutput>
**السطر:** 25-27
**الدور:** الوظيفة الرئيسية المُصدرة لتوليد الأفكار
**التفصيل:**
- **السطر 25:** تعريف الدالة كـ async وتصديرها
- **السطر 26:** استدعاء التدفق (flow) الداخلي وإرجاع النتيجة
- **السطر 27:** إغلاق الدالة

#### prompt
**السطر:** 29-39
**الدور:** تعريف prompt للذكاء الاصطناعي
**التفصيل:**
- **السطر 29:** تعريف prompt باستخدام ai.definePrompt
- **السطر 30:** تعيين اسم الـ prompt
- **السطر 31:** تحديد مخطط الإدخال
- **السطر 32:** تحديد مخطط الإخراج
- **السطر 33:** بداية نص الـ prompt
- **السطر 33:** تعريف الذكاء الاصطناعي ككاتب سيناريو مبدع
- **السطر 33:** طلب توليد 3 أفكار للمشاهد
- **السطر 34:** إدراج الموضوع/الملخص باستخدام {{{theme}}}
- **السطر 37:** تحديد تنسيق JSON المطلوب للإخراج
- **السطر 38:** إغلاق الـ prompt

#### generateSceneIdeasFlow
**السطر:** 41-51
**الدور:** تدفق (flow) Genkit الذي ينفذ عملية توليد الأفكار
**التفصيل:**
- **السطر 41:** تعريف التدفق باستخدام ai.defineFlow
- **السطر 42-45:** إعدادات التدفق (الاسم، الإدخال، الإخراج)
- **السطر 47:** بداية الدالة المُنفذة للتدفق
- **السطر 48:** استدعاء الـ prompt مع الإدخال والحصول على النتيجة
- **السطر 49:** إرجاع الإخراج فقط
- **السطر 50:** إغلاق الدالة
- **السطر 51:** إغلاق تعريف التدفق

---

## استخدام الوحدات في التطبيق

### تنسيق السيناريو تلقائياً
```typescript
import { autoFormatScreenplay } from '@/ai/flows/auto-format-screenplay';

const result = await autoFormatScreenplay({
  rawText: 'INT. COFFEE SHOP - DAY\nJohn enters...'
});

console.log(result.formattedScreenplay);
```

### توليد أفكار للمشاهد
```typescript
import { generateSceneIdeas } from '@/ai/flows/generate-scene-ideas';

const result = await generateSceneIdeas({
  theme: 'قاء عاطفي بين حبيبين منفصلين'
});

console.log(result.sceneIdeas); // مصفوفة من 3 أفكار
console.log(result.progress);   // ملخص ما تم توليده
```

---

## ملاحظات مهمة

### متغيرات البيئة المطلوبة
يجب تعيين متغير البيئة التالي في ملف `.env`:
```
GOOGLE_GENAI_API_KEY=your_api_key_here
```

### نموذج Gemini 2.5 Flash
- سريع وفعال للمهام اليومية
- يدعم اللغة العربية
- مناسب للتطبيقات التفاعلية

### تشغيل Genkit CLI
```bash
npx genkit start
```
هذا الأمر يفتح واجهة Genkit Dev UI لاختبار الدوال محلياً.

---

## الخلاصة
هذه الوحدات توفر وظائف ذكاء اصطناعي قوية لمحرر السيناريو:
1. **تنسيق تلقائي** للسيناريوهات من نص خام
2. **توليد أفكار** للمشاهد بناءً على موضوع معين
3. **بنية قابلة للتوسع** لإضافة وظائف ذكاء اصطناعي إضافية

تستخدم جميع الوحدات:
- Google Genkit لإدارة التدفقات
- نموذج Gemini 2.5 Flash للاستدلال
- Zod للتحقق من صحة البيانات
