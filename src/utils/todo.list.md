 
 1

// الحاوية الرئيسية مع الوضع الليلي/النهاري
<div
  className={`min-h-screen ${isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-black'}`}
  dir="rtl"
>
```

#### ب) تصميم الهيدر (Header with Glass Morphism)

```tsx
<header className="border-b border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-900/70 text-white sticky top-0 z-10 backdrop-blur-xl shadow-2xl shadow-black/20">
  <div className="flex items-center justify-between px-4 py-3">
    {/* Logo Section */}
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
        <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30">
          <Film className="text-blue-400 w-5 h-5" />
        </div>
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight bg-gradient-to-l from-white to-white/70 bg-clip-text text-transparent">
          النسخة
        </h1>
        <p className="text-xs text-white/50 font-medium tracking-wide">
          أڨان تيتر
        </p>
      </div>
    </div>
    
    {/* Action Buttons */}
    <div className="flex items-center gap-2">
      {/* أزرار القوائم والإجراءات */}
    </div>
  </div>
</header>



2



<div className="flex-1 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-auto">
  {/* Subtle ambient background glow */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
    <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl"></div>
  </div>
  
  {/* Content */}
  <div className="relative px-6 pb-6 pt-0">
    {/* حاوية الكتابة */}
  </div>
</div>



3 

<div className="no-print sidebar w-64 border-l border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/60 backdrop-blur-xl">
  <div className="p-4">
    <div className="grid grid-cols-4 gap-2">
      {/* أدوات التحكم */}
    </div>
  </div>
</div>


{/* Search Dialog - Elegant Design */}
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
  <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl p-6 w-[400px] shadow-2xl shadow-black/50">
    {/* محتوى النافذة */}
  </div>
</div>


4


<div
  ref={editorRef}
  contentEditable
  className="screenplay-page focus:outline-none relative z-10"
  style={{
    boxSizing: 'border-box',
    fontFamily: selectedFont,           // الخط المختار
    fontSize: selectedSize,             // حجم الخط
    direction: 'rtl',                   // اتجاه النص من اليمين لليسار
    lineHeight: '14pt',                 // ارتفاع السطر
    width: '210mm',                     // عرض الصفحة (A4)
    minHeight: '297mm',                 // ارتفاع الصفحة (A4)
    margin: '0 auto',                   // محاذاة في المنتصف
    paddingTop: '1in',                  // حاشية علوية
    paddingBottom: '0.5in',             // حاشية سفلية
    paddingRight: '1.5in',              // حاشية يمنى
    paddingLeft: '1in',                 // حاشية يسرى
    backgroundColor: 'white',           // خلفية بيضاء
    color: 'black',                     // لون النص أسود
    borderRadius: '16px',               // زوايا مستديرة
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  }}
  onKeyDown={handleKeyDown}
  onPaste={handlePaste}
  onInput={updateContent}
/>