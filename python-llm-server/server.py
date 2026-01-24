"""
FastAPI Server for LFM2.5-1.2B-Thinking Model
Screenplay Classification Service
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="LFM2.5 Screenplay Classifier", version="1.0.0")

# Model configuration
MODEL_NAME = "LiquidAI/LFM2.5-1.2B-Thinking"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Global model variables
tokenizer = None
model = None

class ClassificationRequest(BaseModel):
    line: str
    context: Optional[str] = None
    previous_type: Optional[str] = None
    scene_context: Optional[str] = None

class ClassificationResponse(BaseModel):
    type: str
    confidence: float
    reasoning: Optional[str] = None

class BatchClassificationRequest(BaseModel):
    lines: List[str]
    context: Optional[List[str]] = None

class BatchClassificationResponse(BaseModel):
    results: List[ClassificationResponse]


@app.on_event("startup")
async def load_model():
    """Load the LFM2.5 model on startup"""
    global tokenizer, model

    logger.info(f"Loading model: {MODEL_NAME}")
    logger.info(f"Device: {DEVICE}")

    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = AutoModelForCausalLM.from_pretrained(
            MODEL_NAME,
            torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32,
            device_map="auto" if DEVICE == "cuda" else None,
        )

        if DEVICE == "cpu":
            model = model.to(DEVICE)

        logger.info("✅ Model loaded successfully!")
    except Exception as e:
        logger.error(f"❌ Failed to load model: {e}")
        raise


def build_classification_prompt(line: str, context: Optional[str] = None, previous_type: Optional[str] = None) -> str:
    """Build prompt for screenplay classification"""

    system_prompt = """أنت خبير في تصنيف نصوص السيناريو العربية.
قم بتصنيف السطر إلى أحد الأنواع التالية:
- scene-header: ترويسة مشهد (مثل: مشهد 1، داخلي. منزل أحمد - نهار)
- action: وصف/حدث (مثل: يدخل أحمد إلى الغرفة)
- character: اسم شخصية (مثل: أحمد، محمد)
- dialogue: حوار بين شخصيات
- transition: انتقال بين المشاهد (مثل: قطع إلى:)
- parenthetical: ملاحظة تمثيل (بين قوسين)
- basmala: البسملة

أرجع التصنيف بصيغة JSON فقط: {"type": "...", "confidence": 0-10, "reasoning": "..."}

القواعد:
- الثقة 10 = تأكد 100%
- الثقة 0-4 = غير مؤكد
- أضف reasoning قصير يشرح السبب"""

    user_content = f"السطر: {line}"

    if context:
        user_content += f"\nالسياق السابق: {context}"

    if previous_type:
        user_content += f"\nالتصنيف السابق: {previous_type}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    return messages


def parse_model_output(output_text: str) -> dict:
    """Parse model output to extract JSON"""

    import json
    import re

    # Try to extract JSON from output
    json_match = re.search(r'\{[^}]*"type"[^}]*\}', output_text)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # Fallback: create default response
    return {"type": "action", "confidence": 3.0, "reasoning": "Failed to parse"}


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "device": DEVICE
    }


@app.post("/classify", response_model=ClassificationResponse)
async def classify_line(request: ClassificationRequest) -> ClassificationResponse:
    """Classify a single screenplay line using LFM2.5"""

    if tokenizer is None or model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Build messages
        messages = build_classification_prompt(
            request.line,
            request.context,
            request.previous_type
        )

        # Tokenize
        inputs = tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(model.device)

        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=100,
                temperature=0.3,  # Lower for more consistent outputs
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )

        # Decode output
        output_text = tokenizer.decode(outputs[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)

        # Parse response
        result = parse_model_output(output_text)

        logger.info(f"Classified '{request.line[:30]}...' as {result['type']} (confidence: {result['confidence']})")

        return ClassificationResponse(**result)

    except Exception as e:
        logger.error(f"Classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/classify/batch", response_model=BatchClassificationResponse)
async def classify_batch(request: BatchClassificationRequest) -> BatchClassificationResponse:
    """Classify multiple lines in one request"""

    results = []

    for i, line in enumerate(request.lines):
        try:
            # Get context
            context = None
            if request.context and i > 0:
                context = " | ".join(request.context[max(0, i-3):i])

            # Get previous type from results
            previous_type = results[-1].type if results else None

            # Classify
            response = await classify_line(ClassificationRequest(
                line=line,
                context=context,
                previous_type=previous_type
            ))
            results.append(response)

        except Exception as e:
            logger.error(f"Error classifying line {i}: {e}")
            # Add fallback
            results.append(ClassificationResponse(
                type="action",
                confidence=0.0,
                reasoning=f"Error: {str(e)}"
            ))

    return BatchClassificationResponse(results=results)


if __name__ == "__main__":
    logger.info("🚀 Starting LFM2.5 Classification Server...")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8001,  # Different from Qwen2.5 port (8000)
        log_level="info"
    )
