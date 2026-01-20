# توثيق مجلد Providers

## نظرة عامة
مجلد `providers` يحتوي على مكونات React المسؤولة عن توفير السياق (Context) للتطبيق بأكمله. هذه المكونات تُستخدم لتغليف التطبيق وتوفير وظائف مشتركة لجميع المكونات الفرعية.

---

## الملفات الموجودة

### 1. `index.ts`
**الدور:** ملف التصدير المركزي للمجلد، يُستخدم لتسهيل استيراد المكونات من مكان واحد.

#### شرح سطر بسطر:

```typescript
export { ThemeProvider } from './ThemeProvider';
```

**السطر 1:**
- `export`: كلمة مفتاحية لتصدير المكون ليكون متاحاً للاستخدام في ملفات أخرى
- `{ ThemeProvider }`: تصدير مُسمى (named export) للمكون ThemeProvider
- `from './ThemeProvider'`: استيراد المكون من ملف ThemeProvider.tsx الموجود في نفس المجلد
- **الهدف:** يسمح باستيراد ThemeProvider مباشرة من مجلد providers بدلاً من تحديد المسار الكامل للملف

**مثال الاستخدام:**
```typescript
// بدلاً من: import { ThemeProvider } from '@/providers/ThemeProvider'
// يمكن استخدام: import { ThemeProvider } from '@/providers'
```

---

### 2. `ThemeProvider.tsx`
**الدور:** مكون React مسؤول عن إدارة وتوفير نظام الثيمات (الوضع الفاتح/الداكن) للتطبيق بأكمله.

#### شرح سطر بسطر:

```typescript
"use client"
```

**السطر 1:**
- توجيه خاص بـ Next.js 13+ (App Router)
- يُحدد أن هذا المكون يجب أن يعمل على جانب العميل (Client Component)
- ضروري لأن المكون يستخدم React hooks وتفاعلات المستخدم
- بدون هذا التوجيه، سيحاول Next.js تشغيل المكون على الخادم مما يسبب أخطاء

---

```typescript
import * as React from "react"
```

**السطر 3:**
- استيراد مكتبة React بالكامل
- `* as React`: استيراد جميع exports من مكتبة react وتجميعها تحت اسم React
- يُستخدم للوصول إلى جميع وظائف React (مثل: React.useState, React.useEffect)
- الاستيراد بهذه الطريقة يُعتبر best practice في TypeScript

---

```typescript
import { ThemeProvider as NextThemesProvider } from "next-themes"
```

**السطر 4:**
- استيراد مكون ThemeProvider من مكتبة next-themes
- `as NextThemesProvider`: إعادة تسمية المكون المستورد لتجنب تضارب الأسماء
- `next-themes`: مكتبة خارجية توفر إدارة متقدمة للثيمات في Next.js
- تدعم الوضع الفاتح/الداكن، حفظ التفضيلات، والكشف التلقائي عن تفضيلات النظام

---

```typescript
import type { ThemeProviderProps } from "next-themes/dist/types"
```

**السطر 5:**
- استيراد نوع TypeScript فقط (type import)
- `type`: كلمة مفتاحية تُحدد أن هذا استيراد للأنواع فقط وليس للكود القابل للتنفيذ
- `ThemeProviderProps`: واجهة TypeScript تُحدد الخصائص (props) المقبولة لمكون ThemeProvider
- `from "next-themes/dist/types"`: المسار الداخلي لملف الأنواع في مكتبة next-themes
- يُستخدم لتوفير type safety وإكمال تلقائي في IDE

---

```typescript
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
```

**السطر 7:**
- `export function`: تصدير دالة مكون React
- `ThemeProvider`: اسم المكون (يجب أن يبدأ بحرف كبير حسب اصطلاحات React)
- `{ children, ...props }`: destructuring للخصائص المُمررة للمكون
  - `children`: المكونات الفرعية التي سيتم تغليفها بهذا Provider
  - `...props`: rest operator لجمع باقي الخصائص في كائن واحد
- `: ThemeProviderProps`: تحديد نوع TypeScript للخصائص المقبولة
- **الهدف:** إنشاء wrapper component يُغلف NextThemesProvider بطريقة مخصصة

---

```typescript
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
```

**السطر 8:**
- `return`: إرجاع JSX الذي سيتم عرضه
- `<NextThemesProvider>`: استخدام المكون الأصلي من مكتبة next-themes
- `{...props}`: spread operator لتمرير جميع الخصائص المستلمة إلى NextThemesProvider
  - يشمل خصائص مثل: attribute, defaultTheme, enableSystem, storageKey, إلخ
- `{children}`: عرض المكونات الفرعية داخل Provider
- `</NextThemesProvider>`: إغلاق الوسم
- **الهدف:** تمرير جميع الوظائف إلى المكون الأصلي مع الحفاظ على واجهة نظيفة

---

```typescript
}
```

**السطر 9:**
- إغلاق قوس دالة ThemeProvider

---

## كيفية الاستخدام

### في ملف التخطيط الرئيسي (layout.tsx):

```typescript
import { ThemeProvider } from '@/providers'

export default function RootLayout({ children }) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### الخصائص المتاحة (Props):

- **attribute**: الطريقة المستخدمة لتطبيق الثيم (class, data-theme, إلخ)
- **defaultTheme**: الثيم الافتراضي (light, dark, system)
- **enableSystem**: تفعيل الكشف التلقائي عن تفضيلات النظام
- **storageKey**: مفتاح التخزين في localStorage
- **themes**: قائمة الثيمات المتاحة
- **forcedTheme**: فرض ثيم معين
- **disableTransitionOnChange**: تعطيل الانتقالات عند تغيير الثيم

---

## الفوائد والمميزات

1. **إدارة مركزية للثيمات:** جميع المكونات الفرعية يمكنها الوصول لحالة الثيم الحالي
2. **حفظ التفضيلات:** يحفظ اختيار المستخدم في localStorage تلقائياً
3. **دعم SSR:** يعمل بشكل صحيح مع Server-Side Rendering في Next.js
4. **منع وميض الثيم:** يمنع ظهور الثيم الخاطئ عند تحميل الصفحة
5. **دعم تفضيلات النظام:** يكتشف تلقائياً إذا كان المستخدم يفضل الوضع الداكن
6. **سهولة الصيانة:** تغليف المكتبة الخارجية يسهل تغييرها مستقبلاً

---

## الاعتمادات (Dependencies)

- **react**: ^18.0.0 أو أحدث
- **next**: ^13.0.0 أو أحدث (مع App Router)
- **next-themes**: ^0.2.0 أو أحدث

---

## ملاحظات تقنية

1. **"use client" ضروري:** لأن next-themes يستخدم React Context و hooks
2. **suppressHydrationWarning:** يجب إضافته لوسم `<html>` لتجنب تحذيرات hydration
3. **Type Safety:** استخدام TypeScript يضمن تمرير الخصائص الصحيحة فقط
4. **Re-export Pattern:** نمط شائع لإنشاء abstraction layer فوق المكتبات الخارجية

---

## التوسعات المستقبلية المحتملة

- إضافة ثيمات مخصصة متعددة (ليس فقط فاتح/داكن)
- دمج مع نظام الألوان الديناميكي
- إضافة animations مخصصة عند تغيير الثيم
- دعم الثيمات حسب الصفحة أو القسم

---

**تاريخ التوثيق:** 2025
**الإصدار:** 1.0.0
