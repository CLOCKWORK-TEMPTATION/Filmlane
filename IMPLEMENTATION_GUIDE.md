# 📚 دليل استخدام الملفات الجديدة

## 🎯 الملفات المنشأة

### 1️⃣ `src/hooks/use-history.ts`
Hook لإدارة سجل التغييرات (Undo/Redo)

**الاستخدام:**
```tsx
import { useHistory } from '@/hooks';

const { state, set, undo, redo, canUndo, canRedo } = useHistory<string>('');

// تحديث الحالة
set('محتوى جديد');

// التراجع والإعادة
if (canUndo) undo();
if (canRedo) redo();
```

### 2️⃣ `src/hooks/use-local-storage.ts`
Hook للحفظ التلقائي في LocalStorage

**الاستخدام:**
```tsx
import { useAutoSave, loadFromStorage } from '@/hooks';

// حفظ تلقائي كل 3 ثواني
useAutoSave('screenplay-content', content, 3000);

// تحميل من التخزين
const savedContent = loadFromStorage('screenplay-content', '');
```

### 3️⃣ `src/utils/file-operations.ts`
دوال حفظ وتحميل الملفات

**الاستخدام:**
```tsx
import { saveScreenplay, loadScreenplay } from '@/utils';

// حفظ السيناريو
const handleSave = () => {
  saveScreenplay({
    content: editorContent,
    metadata: {
      title: 'عنوان السيناريو',
      author: 'اسم الكاتب',
      date: new Date().toISOString(),
      version: '1.0'
    }
  }, 'my-screenplay.json');
};

// تحميل السيناريو
const handleLoad = async () => {
  const data = await loadScreenplay();
  if (data) {
    setContent(data.content);
  }
};
```

### 4️⃣ `src/utils/exporters.ts`
دوال التصدير (PDF و Fountain)

**الاستخدام:**
```tsx
import { exportToPDF, exportToFountain, downloadFile } from '@/utils';

// تصدير إلى PDF
const handleExportPDF = () => {
  const editorElement = document.getElementById('editor');
  if (editorElement) {
    exportToPDF(editorElement, 'screenplay.pdf');
  }
};

// تصدير إلى Fountain
const handleExportFountain = () => {
  const editorElement = document.getElementById('editor');
  if (editorElement) {
    const fountainText = exportToFountain(editorElement.innerHTML);
    downloadFile(fountainText, 'screenplay.fountain', 'text/plain');
  }
};
```

## 🔗 دمج مع ScreenplayEditor

```tsx
import { useHistory, useAutoSave } from '@/hooks';
import { saveScreenplay, exportToPDF, exportToFountain } from '@/utils';

function ScreenplayEditor() {
  const { state: content, set: setContent, undo, redo, canUndo, canRedo } = 
    useHistory<string>('');
  
  // حفظ تلقائي
  useAutoSave('screenplay-autosave', content, 3000);

  const handleHistory = (action: 'undo' | 'redo') => {
    if (action === 'undo' && canUndo) undo();
    if (action === 'redo' && canRedo) redo();
  };

  const handleSave = () => {
    saveScreenplay({
      content,
      metadata: {
        title: 'سيناريو جديد',
        author: 'الكاتب',
        date: new Date().toISOString(),
        version: '1.0'
      }
    });
  };

  const handleDownload = (format: 'pdf' | 'fountain') => {
    const editor = document.getElementById('editor');
    if (!editor) return;

    if (format === 'pdf') {
      exportToPDF(editor, 'screenplay.pdf');
    } else {
      const fountainText = exportToFountain(editor.innerHTML);
      downloadFile(fountainText, 'screenplay.fountain');
    }
  };

  return (
    // ... JSX
  );
}
```

## ✅ الميزات المنفذة

- ✅ Undo/Redo كامل مع تتبع السجل
- ✅ حفظ تلقائي في LocalStorage
- ✅ حفظ يدوي كملف JSON
- ✅ تحميل من ملف JSON
- ✅ تصدير إلى PDF (باستخدام window.print)
- ✅ تصدير إلى Fountain format
- ✅ جميع الدوال معزولة وقابلة لإعادة الاستخدام
