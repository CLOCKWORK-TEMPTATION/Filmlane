# توثيق ملفات التطبيق (App Files Documentation)

## نظرة عامة
هذا الملف يوثق ملفات التطبيق الأساسية في مشروع Filmlane. هذه الملفات تشكل الأساس لتطبيق Next.js وتحدد بنية الصفحات والتصاميم العامة.

---

## هيكل المجلد
```
src/app/
├── layout.tsx       # التخطيط الجذري للتطبيق
├── page.tsx         # الصفحة الرئيسية
├── globals.css      # الأنماط العامة والمتغيرات
└── favicon.ico      # أيقونة الموقع
```

---

## 1. layout.tsx
**المسار:** [src/app/layout.tsx](src/app/layout.tsx)

**الدور:** التخطيط الجذري (Root Layout) للتطبيق - يحدد البنية الأساسية لجميع الصفحات.

### الواردات (Imports)
```typescript
import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/providers';
import { Toaster } from '@/components/ui/toaster';
```
- **السطر 1:** استيراد نوع Metadata من Next.js
- **السطر 2:** استيراد ملف الأنماط العامة
- **السطر 3:** استيراد مزود الثيم (ThemeProvider)
- **السطر 4:** استيراد مكون الإشعارات (Toaster)

### البيانات الوصفية (Metadata)
**السطر:** 7-10
```typescript
export const metadata: Metadata = {
  title: 'محرر السيناريو العربي',
  description: 'محرر سيناريو متقدم للكتابة العربية',
};
```
- **السطر 7:** تعريف كائن metadata وتصديره
- **السطر 8:** عنوان التطبيق (يظهر في تبويب المتصفح)
- **السطر 9:** وصف التطبيق (يستخدمه SEO ومشاركة الروابط)
- **السطر 10:** إغلاق الكائن

### دالة RootLayout
**السطر:** 12-22
**الدور:** المكون الرئيسي الذي يغلف جميع صفحات التطبيق
**التفصيل:**
- **السطر 12:** تصدير دالة التخطيط الافتراضية
- **السطر 13-16:** تعريف props للدالة
  - children: محتوى الصفحات الفرعية
- **السطر 17:** بداية إرجاع JSX
- **السطر 18:** عنصر HTML مع تحديد اللغة العربية (lang="ar")
- **السطر 18:** تحديد اتجاه اليمين لليسار (dir="rtl") للعربية
- **السطر 19:** عنصر body مع تطبيق الخط الافتراضي
  - font-sans: خط sans-serif الافتراضي
  - antialiased: تحسين ج عرض النص
  - {children}: إدراج محتوى الصفحات
- **السطر 20:** إغلاق body
- **السطر 21:** إغلاق html
- **السطر 22:** إغلاق الدالة

---

## 2. page.tsx
**المسار:** [src/app/page.tsx](src/app/page.tsx)

**الدور:** الصفحة الرئيسية للتطبيق (Home Page).

### الواردات (Imports)
```typescript
import { ScreenplayEditor } from '@/components/editor';
```
- **السطر 1:** استيراد مكون محرر السيناريو

### دالة Home
**السطر:** 3-5
**الدور:** المكون الرئيسي للصفحة الرئيسية
**التفصيل:**
- **السطر 3:** تصدير دالة المكون الافتراضية
- **السطر 4:** إرجاع مكون ScreenplayEditor
- **السطر 5:** إغلاق الدالة

**ملاحظة:** هذه الصفحة بسيطة جداً لأنها تعرض محرر السيناريو مباشرة كواجهة رئيسية.

---

## 3. globals.css
**المسار:** [src/app/globals.css](src/app/globals.css)

**الدور:** ملف الأنماط العامة الذي يحتوي على:
- توجيهات Tailwind CSS
- تعريف الخطوط
- متغيرات التصميم (Colors, Spacing, Typography)
- أنماط الوضع الليلي/النهاري
- مكونات التصميم المتقدمة
- تأثيرات الحركة الحديثة

### القسم الأول: توجيهات Tailwind والخطوط
**السطر:** 1-23

#### توجيهات Tailwind
**السطر:** 1-3
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```
- **السطر 1:** تضمين أنماط Tailwind الأساسية
- **السطر 2:** تضمين مكونات Tailwind
- **السطر 3:** تضمين أدوات Tailwind

#### تعريف خط AzarMehr
**السطر:** 5-19
```css
@font-face {
  font-family: 'AzarMehrMonospaced-San';
  src: url('/fonts/AzarMehrMonospaced_Sans_Regular.ttf') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
```
- **السطر 5:** تعريف وجه خط جديد
- **السطر 6:** اسم الخط
- **السطر 7:** مسار ملف الخط
- **السطر 8:** وزن الخط (400 = عادي)
- **السطر 9:** نمط الخط (normal)
- **السطر 10:** طريقة عرض الخط (swap لتحميل سريع)

**السطر 13-19:** نفس التعريف للنسخة العريضة (700 = Bold)

---

### القسم الثاني: متغيرات التصميم (الوضع الفاتح)
**السطر:** 26-116

#### متغيرات الألوان الأساسية
**السطر:** 28-46
```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  /* ... */
}
```
- **السطر 26-27:** تعريف الجذر (:root) للوضع الفاتح
- **السطر 28:** لون الخلفية (أبيض)
- **السطر 29:** لون النص (أسود)
- **السطر 30-46:** ألوان البطاقات، القوائم، الأزرار، إلخ

#### متغيرات الرسوم البيانية
**السطر:** 48-53
```css
--chart-1: oklch(0.646 0.222 41.116);
--chart-2: oklch(0.6 0.118 184.704);
/* ... */
```
- ألوان خاصة بالرسوم البيانية والتصورات

#### متغيرات الألوان السياقية
**السطر:** 55-60
```css
--accent-creative: oklch(0.7 0.15 330); /* وردي إبداعي */
--accent-technical: oklch(0.65 0.18 220); /* أزرق تقني */
--accent-success: oklch(0.7 0.15 140); /* أخضر نجاح */
--accent-warning: oklch(0.75 0.15 80); /* أصفر تحذير */
--accent-error: oklch(0.6 0.2 25); /* أحمر خطأ */
```
- ألوان مخصصة لسياقات مختلفة في التطبيق

#### متغيرات التخطيط
**السطر:** 67-81
```css
--radius: 0.625rem;
--radius-lg: 1rem;
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
/* ... */
```
- زوايا الحواف
- نظام المسافات (بمضاعفات 8px)

#### متغيرات الطباعة
**السطر:** 83-91
```css
--text-xs: 0.64rem; /* 10.24px */
--text-sm: 0.8rem; /* 12.8px */
--text-base: 1rem; /* 16px */
/* ... */
```
- أحجام النصوص بنسبة 1.25

#### متغيرات الحركة
**السطر:** 93-98
```css
--duration-fast: 150ms;
--duration-normal: 300ms;
--easing-default: cubic-bezier(0.4, 0, 0.2, 1);
```
- مدد الحركة المختلفة
- دوال التسهيل (easing functions)

---

### القسم الثالث: متغيرات التصميم (الوضع المظلم)
**السطر:** 118-172

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  /* ... */
}
```
- نفس المتغيرات السابقة بقيم مظلمة
- تُفعّل بإضافة الفئة .dark

---

### القسم الرابع: الطبقة الأساسية (@layer base)
**السطر:** 174-207

#### تعريف الخط الموحد
**السطر:** 176-178
```css
:root {
  --font-family: 'Cairo', system-ui, -apple-system, sans-serif;
}
```
- تحديد خط Cairo كخط أساسي للتطبيق

#### تطبيق الخط على جميع العناصر
**السطر:** 180-184
```css
* {
  border-color: var(--border);
  outline-color: color-mix(in oklch, var(--ring) 50%, transparent);
  font-family: var(--font-family);
}
```
- تطبيق لون الحدود
- لون التركيز (outline)
- الخط على جميع العناصر

#### أنماط body
**السطر:** 186-190
```css
body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-family);
}
```
- لون الخلفية
- لون النص
- الخط

#### أنماط العناوين
**السطر:** 192-199
```css
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-family);
}
```

#### أنماط عناصر النماذج
**السطر:** 201-206
```css
input, textarea, button, select {
  font-family: var(--font-family);
}
```

---

### القسم الخامس: مكونات التصميم (@layer components)
**السطر:** 209-379

#### تأثيرات Hero
**السطر:** 210-217
```css
.hero-animation-root {
  min-height: 100vh;
  background: radial-gradient(
    ellipse at 50% 30%,
    rgba(20, 20, 25, 1) 0%,
    rgba(0, 0, 0, 1) 70%
  );
}
```

#### أنماط العنوان الرئيسي
**السطر:** 219-237
```css
.video-text-mask__title {
  font-size: clamp(8rem, 28vw, 28rem);
  font-weight: 900;
  /* ... */
}
```

#### النمط الموحد للنص
**السطر:** 239-257
```css
.unified-text-style {
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  /* ... */
}
```

#### تأثيرات البطاقات
**السطر:** 355-369
```css
.card-elite {
  border-radius: 18px;
  border: 2px solid #ffd700;
  background-color: rgba(10, 10, 10, 0.15);
  backdrop-filter: blur(8px);
  box-shadow: 0px 0px 15px rgba(255, 215, 0, 0.6);
}
```

---

### القسم السادس: ميزات CSS الحديثة
**السطر:** 381-505

#### View Transitions API
**السطر:** 387-416
```css
@view-transition {
  navigation: auto;
}

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--duration-normal);
}
```
- تأثيرات انتقال الصفحات

#### الحركة المبنية على التمرير
**السطر:** 418-468
```css
@keyframes fade-in-scroll {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.scroll-animate {
  animation: fade-in-scroll linear;
  animation-timeline: view();
}
```

#### Container Queries
**السطر:** 470-505
```css
.card-container {
  container-type: inline-size;
  container-name: card;
}

@container card (min-width: 300px) {
  .card-adaptive { display: grid; }
}
```

---

### القسم السابع: مكونات UI حديثة
**السطر:** 507-875

#### تأثيرات التوهج
**السطر:** 509-526
```css
.glow-brand {
  box-shadow: 0 0 20px var(--brand),
              0 0 40px color-mix(in oklch, var(--brand) 50%, transparent);
}
```

#### خلفيات متدرجة
**السطر:** 528-544
```css
.bg-gradient-brand {
  background: linear-gradient(
    135deg,
    var(--gradient-start),
    var(--gradient-middle),
    var(--gradient-end)
  );
}
```

#### تأثير الزجاج (Glass Morphism)
**السطر:** 554-565
```css
.glass {
  background: color-mix(in oklch, var(--background) 80%, transparent);
  backdrop-filter: blur(12px);
  border: 1px solid color-mix(in oklch, var(--border) 50%, transparent);
}
```

#### البطاقات التفاعلية
**السطر:** 567-582
```css
.card-interactive:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px -12px color-mix(in oklch, var(--foreground) 20%, transparent);
}
```

#### تأثير Skeleton Loading
**السطر:** 595-615
```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--muted) 25%,
    color-mix(in oklch, var(--muted) 80%, var(--background)) 50%,
    var(--muted) 75%
  );
  animation: skeleton-loading 1.5s ease-in-out infinite;
}
```

#### زر الإجراء العائم (FAB)
**السطر:** 626-653
```css
.fab {
  position: fixed;
  bottom: var(--space-6);
  left: var(--space-6);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--brand);
}
```

---

### القسم الثامن: أدوات مساعدة (@layer utilities)
**السطر:** 877-1003

#### أدوات RTL
**السطر:** 879-894
```css
.start-0 { inset-inline-start: 0; }
.end-0 { inset-inline-end: 0; }
```

#### تأخيرات الحركة
**السطر:** 896-911
```css
.animation-delay-100 { animation-delay: 100ms; }
.animation-delay-200 { animation-delay: 200ms; }
```

#### نصوص متدرجة
**السطر:** 913-919
```css
.text-gradient-brand {
  background: linear-gradient(135deg, var(--brand), var(--accent-creative));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

### القسم التاسع: Keyframes
**السطر:** 1005-1068

#### تأثيرات الحركة
**السطر:** 1012-1059
```css
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(2rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1rem); } }
@keyframes glow-pulse { 0%, 100% { box-shadow: 0 0 20px var(--primary); } 50% { box-shadow: 0 0 40px var(--primary); } }
```

---

## 4. favicon.ico
**المسار:** [src/app/favicon.ico](src/app/favicon.ico)

**الدور:** أيقونة الموقع التي تظهر في:
- تبويب المتصفح
- المفضلة
- نتائج البحث

**ملاحظة:** هذا ملف صورة (ICO) ولا يحتاج إلى توثيق تفصيلي.

---

## استخدام الملفات

### هيكل الصفحة النهائية
```
html (lang="ar" dir="rtl")
└── body
    └── ThemeProvider
        └── Toaster
            └── ScreenplayEditor
```

### تفعيل الوضع المظلم
```typescript
import { useTheme } from 'next-themes';

function Component() {
  const { setTheme } = useTheme();
  setTheme('dark'); // يضيف فئة .dark
}
```

### استخدام متغيرات التصميم
```css
.my-element {
  background: var(--background);
  color: var(--foreground);
  padding: var(--space-4);
  border-radius: var(--radius);
}
```

---

## الخلاصة
هذه الملفات تشكل الأساس التقني للتطبيق:

1. **layout.tsx**: البنية الأساسية لجميع الصفحات
2. **page.tsx**: الصفحة الرئيسية (محرر السيناريو)
3. **globals.css**: نظام تصميم شامل يتضمن:
   - متغيرات CSS للوضع الفاتح/المظلم
   - نظام ألوان احترافي (OKLCH)
   - مكونات UI جاهزة
   - تأثيرات حركة حديثة
   - دعم كامل للغة العربية (RTL)
4. **favicon.ico**: هوية بصرية للموقع

جميع هذه الملفات تعمل معاً لتوفير تجربة مستخدم احترافية وعصرية.
