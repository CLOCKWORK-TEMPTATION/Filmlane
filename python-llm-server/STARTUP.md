# دليل تشغيل LFM2.5-Thinking لنظام التصنيف

## 📋 نظرة سريعة

النظام الآن يدعم **نموذجين LLM**:

| النموذج             | المنفذ           | الاستخدام                          |
| ------------------- | ---------------- | ---------------------------------- |
| **Qwen2.5-14B**     | `localhost:8000` | LLM الأساسي (سريع، 1.2B params)    |
| **LFM2.5-Thinking** | `localhost:8001` | نموذج thinking (جديد، 1.2B params) |

---

## 🚀 خطوات التشغيل

### 1️⃣ تشغيل خادم LFM2.5 (Python)

افتح terminal جديد وشغّل:

```bash
cd "e:\yarab we elnby\New folder\Filmlane\python-llm-server"

# Install dependencies (first time only)
pip install -r requirements.txt

# Run the server
python server.py
```

**أول مرة سيحمل النموذج (~5-10 دقائق)** - سيظهر:

```
🚀 Starting LFM2.5 Classification Server...
INFO:     Started server process [1234]
INFO:     Waiting for application startup.
✅ Model loaded successfully!
INFO:     Uvicorn running on http://127.0.0.1:8001
```

### 2️⃣ تشغيل Next.js (TypeScript)

افتح terminal آخر:

```bash
cd "e:\yarab we elnby\New folder\Filmlane"
npm run dev
```

---

## 🧪 اختبار النظام

### اختبار API مباشرة:

```bash
curl -X POST http://127.0.0.1:8001/classify \
  -H "Content-Type: application/json" \
  -d "{\"line\": \"يدخل أحمد\"}"
```

### الاستخدام من TypeScript:

```typescript
import { lfmClassifier } from '@/utils/classification/lfm-classifier';

const result = await lfmClassifier.classify(
  'يدخل أحمد إلى الغرفة',
  'مشهد 1 - منزل',
  'scene-header',
);

console.log(result.type); // "action"
console.log(result.confidence); // 9.5
```

---

## 📁 الملفات الجديدة

| الملف                                        | الوصف                  |
| -------------------------------------------- | ---------------------- |
| `python-llm-server/server.py`                | FastAPI server للنموذج |
| `python-llm-server/requirements.txt`         | مكتبات Python          |
| `src/app/api/lfm-proxy/route.ts`             | Next.js API proxy      |
| `src/utils/classification/lfm-classifier.ts` | TypeScript service     |

---

## 🔧 التكامل مع النظام الحالي

### استخدام LFM2.5 في `paste-classifier.ts`:

```typescript
import { lfmClassifier } from './classification/lfm-classifier';

// بعد decision engine، إذا احتجنا LLM:
if (decision.shouldUseLLM) {
  try {
    // Check if LFM is available
    const lfmAvailable = await lfmClassifier.healthCheck();

    if (lfmAvailable) {
      const result = await lfmClassifier.classify(
        line,
        ctx.previousLines.join(' | '),
        ctx.previousTypes.slice(-1)[0],
      );

      return {
        type: result.type,
        score: result.confidence * 10, // Scale to 0-10
        decision: { shouldUseLLM: false, reason: 'lfm_used' },
      };
    }
  } catch (e) {
    logger.warning('LFM unavailable, falling back to Qwen2.5');
  }

  // Fallback to Qwen2.5 (existing)
}
```

---

## ⚙️ الإعدادات

### تفعيل/تعطيل LFM2.5:

```typescript
import { lfmClassifier } from '@/utils/classification/lfm-classifier';

// Disable LFM2.5
lfmClassifier.setEnabled(false);

// Enable LFM2.5
lfmClassifier.setEnabled(true);
```

### تغيير timeout:

```typescript
lfmClassifier.setTimeout(60000); // 60 seconds
```

---

## ⚡ الأداء

| العمل                   | الوقت المقدر |
| ----------------------- | ------------ |
| تحميل النموذج (أول مرة) | 5-10 دقائق   |
| تصنيف سطر واحد (GPU)    | ~0.5 ثانية   |
| تصنيف سطر واحد (CPU)    | ~5 ثوان      |
| تصنيف 10 أسطر (GPU)     | ~3 ثوان      |

---

## 🐛 استكشاف الأخطاء

### Port 8001 مشغول:

```python
# غير البورت في python-llm-server/server.py
uvicorn.run(app, host="127.0.0.1", port=8002)  # تغيير إلى 8002
```

### CUDA Out of Memory:

```python
# النموذج سيتحول تلقائياً إلى CPU
# لكن يمكنك إجبار استخدام CPU من البداية:
# في server.py، استبدل:
DEVICE = "cpu"
```

### ImportError: transformers:

```bash
pip install --upgrade transformers torch
```

---

## 🎯 نصائح الأداء

1. **استخدم LFM2.5 للثقة المتوسطة فقط** - أبطأ من Qwen2.5 لكنه "thinking model"
2. **استخدم Qwen2.5 للسرعة** - أسرع لكن بدون thinking
3. **Batch requests** - أسرع من استدعاءات فردية
4. **GPU highly recommended** - 10x أسرع من CPU
