# LFM2.5 Thinking Model - Screenplay Classification Server

FastAPI server running the LiquidAI/LFM2.5-1.2B-Thinking model for Arabic screenplay classification.

## Setup

1. **Install Python 3.9+**

2. **Install dependencies:**
   ```bash
   cd python-llm-server
   pip install -r requirements.txt
   ```

3. **Run the server:**
   ```bash
   python server.py
   ```

Server will start at: `http://127.0.0.1:8001`

## API Endpoints

### POST `/classify`
Classify a single screenplay line.

**Request:**
```json
{
  "line": "يدخل أحمد إلى الغرفة",
  "context": "مشهد 1 - داخلي. منزل",
  "previous_type": "scene-header"
}
```

**Response:**
```json
{
  "type": "action",
  "confidence": 9.5,
  "reasoning": "يبدأ بفعل حركي 'يدخل'"
}
```

### POST `/classify/batch`
Classify multiple lines at once.

**Request:**
```json
{
  "lines": ["أحمد: مرحباً", "كيف حالك؟"],
  "context": ["يدخل أحمد"]
}
```

**Response:**
```json
{
  "results": [
    {"type": "character", "confidence": 9.0},
    {"type": "dialogue", "confidence": 8.5}
  ]
}
```

## Model Info

- **Model:** LiquidAI/LFM2.5-1.2B-Thinking
- **Size:** ~2.4GB
- **Device:** CUDA (GPU) or CPU
- **First run:** Downloads model from HuggingFace (~5-10 minutes)

## Troubleshooting

### CUDA Out of Memory
If you get GPU OOM error, the model will automatically fall back to CPU.

### Port Already in Use
If port 8001 is busy, change it in `server.py`:
```python
uvicorn.run(app, host="127.0.0.1", port=8002)
```

### Slow Performance
- **GPU:** ~0.5 second per request
- **CPU:** ~5 seconds per request
