'use server';

/**
 * Screenplay Content Service powered by Gemini 2.5 Flash-Lite
 * Optimized for High-Speed Production Workflows (January 2026)
 *
 * Server Action implementation for secure API key usage.
 */

import { GoogleGenAI } from '@google/genai';
import { AIPayload, AIPatchOp } from './ai-reviewer';
import { logger } from './logger';

const MODEL_NAME = 'gemini-2.5-flash-lite';

/**
 * Sends the screenplay block to Gemini for intelligent review.
 */
export async function reviewContent(payload: AIPayload): Promise<AIPatchOp[]> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    logger.error('AI', 'GOOGLE_API_KEY not found in environment variables.');
    return [];
  }

  const client = new GoogleGenAI({ apiKey });

  console.warn(
    `[AI] Starting content review process (Server-Side)... lines: ${payload.pasted_block.length}`,
  );

  try {
    // استراتيجية التقسيم المحسنة لـ Gemini 2.5
    const MAX_CHUNK_LINES = 500;
    const MAX_CHUNK_CHARS = 30000;

    const chunks: (typeof payload.pasted_block)[] = [];
    let currentChunk: typeof payload.pasted_block = [];
    let currentSize = 0;

    for (const line of payload.pasted_block) {
      const lineLen = line.text.length;
      if (currentChunk.length >= MAX_CHUNK_LINES || currentSize + lineLen > MAX_CHUNK_CHARS) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentSize = 0;
      }
      currentChunk.push(line);
      currentSize += lineLen;
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);

    console.warn(`[AI] Split payload into ${chunks.length} chunks for processing.`);

    const allPatches: AIPatchOp[] = [];

    // Process chunks
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const promptText = `
أنت محرك برمجي صارم (Strict Engine) لاستخراج بيانات JSON فقط. لست مساعداً للمحادثة.
المهمة: تحليل النص واستخراج تصحيحات (Patches) للأخطاء فقط.

Schema:
{
  "patches": [
    { "op": "relabel", "id": "line-id", "to": "character" },
    { "op": "split_inline", "id": "line-id", "delimiter": ":", "to": ["character", "dialogue"] }
  ]
}

القواعد الصارمة (Strict Rules):
1. المخرج الوحيد المقبول هو كائن JSON صالح. ممنوع كتابة أي كلمة خارج الـ JSON.
2. اي سطر يحتوي على "اسم: حوار" (مثل: "أحمد: نعم") ويعتبر Action، يجب فصله بـ "split_inline".
3. أي سطر يبدو كحوار لكنه مصنف Action، صّححه بـ "relabel".
4. لا تخترع أخطاء. إذا كان السطر صحيحاً، تجاهله.

مثال تدريبي (Training Example):
Input:
[ 
  { "id": "L1", "text": "سارة: مستحيل!", "type": "action" }, 
  { "id": "L2", "text": "تغادر الغرفة", "type": "action" } 
]

Output:
{
  "patches": [
    { "op": "split_inline", "id": "L1", "delimiter": ":", "to": ["character", "dialogue"] }
  ]
}

Input Data:
${JSON.stringify(chunk)}
`.trim();

      try {
        const response = await client.models.generateContent({
          model: MODEL_NAME,
          contents: promptText,
        });

        const content = response.text || '';

        let parsedPatches: unknown = null;
        try {
          parsedPatches = JSON.parse(content);
        } catch {
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            try {
              parsedPatches = JSON.parse(match[0]);
            } catch (parseError) {
              console.error('[AI] JSON parse failed', parseError);
            }
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseData = parsedPatches as any;
        if (responseData && Array.isArray(responseData.patches)) {
          allPatches.push(...responseData.patches);
        }
      } catch (err) {
        console.error(`[AI] Error processing chunk ${i + 1}`, err);
      }
    }

    return allPatches;
  } catch (error: unknown) {
    console.error('[AI] Critical failure during content review', error);
    return [];
  }
}
