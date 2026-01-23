
import { AIPayload, AIPatchOp } from './ai-reviewer';
import { logger } from './logger';

const API_ENDPOINT = '/api/ai-proxy';

type CompletionResponse = {
    choices?: Array<{ text?: string }>;
    error?: { message?: string };
};

export const ScreenplayContentService = {
    /**
     * Sends the screenplay block to the AI for review.
     */
    reviewContent: async (payload: AIPayload): Promise<AIPatchOp[]> => {
        logger.info('AI', 'Sending content for review...', { lines: payload.pasted_block.length });

        try {
            // Chunking Strategy:
            // Split the payload into chunks of ~60 lines or ~4000 chars to fit 8192 token limit of Qwen 2.5.
            const MAX_CHUNK_LINES = 60;
            const MAX_CHUNK_CHARS = 4000;

            const chunks: typeof payload.pasted_block[] = [];
            let currentChunk: typeof payload.pasted_block = [];
            let currentSize = 0;

            for (const line of payload.pasted_block) {
                const lineLen = line.text.length;
                if (currentChunk.length >= MAX_CHUNK_LINES || (currentSize + lineLen) > MAX_CHUNK_CHARS) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                    currentSize = 0;
                }
                currentChunk.push(line);
                currentSize += lineLen;
            }
            if (currentChunk.length > 0) chunks.push(currentChunk);

            logger.info('AI', `Split payload into ${chunks.length} chunks for processing.`);

            const allPatches: AIPatchOp[] = [];

            // Process chunks strictly sequentially to avoid overwhelming the local server
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                logger.info('AI', `Processing chunk ${i + 1}/${chunks.length} (${chunk.length} lines)...`);

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
${JSON.stringify(chunk, null, 2)}

Output (JSON):
`.trim();

                try {
                    const response = await fetch(API_ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer local-ai'
                        },
                        body: JSON.stringify({
                            model: 'qwen25-14b',
                            prompt: promptText,
                            max_tokens: 1500,
                            temperature: 0,
                            stop: undefined // Do not stop at "}", let it finish JSON
                        })
                    });

                    if (!response.ok) {
                        logger.error('AI', `Chunk ${i + 1} failed: ${response.statusText}`);
                        continue; // Skip failed chunk, keep others
                    }

                    const data = (await response.json()) as CompletionResponse;
                    const content = data.choices?.[0]?.text || "";

                    // Robust JSON Extraction Strategy
                    let parsedPatches: any = null;

                    // 1. Try direct parse first (fastest, assumes clean output)
                    try {
                        parsedPatches = JSON.parse(content);
                    } catch (e) {
                        // 2. Fallback: Brace Balancing Extractor
                        // Finds the first valid {...} block that matches JSON structure
                        const extractJSON = (str: string): any => {
                            let braceCount = 0;
                            let startIndex = -1;
                            let inString = false;

                            for (let j = 0; j < str.length; j++) {
                                const char = str[j];

                                // Toggle string state to ignore braces inside strings
                                if (char === '"' && (j === 0 || str[j - 1] !== '\\')) {
                                    inString = !inString;
                                }

                                if (!inString) {
                                    if (char === '{') {
                                        if (braceCount === 0) startIndex = j;
                                        braceCount++;
                                    } else if (char === '}') {
                                        braceCount--;
                                        if (braceCount === 0 && startIndex !== -1) {
                                            // Found a potential block
                                            const candidate = str.substring(startIndex, j + 1);
                                            try {
                                                return JSON.parse(candidate);
                                            } catch (err) {
                                                // Continue searching if this block wasn't valid JSON
                                            }
                                        }
                                    }
                                }
                            }
                            return null;
                        };

                        parsedPatches = extractJSON(content);
                    }

                    if (parsedPatches && Array.isArray(parsedPatches.patches)) {
                        allPatches.push(...parsedPatches.patches);
                    } else {
                        logger.warning('AI', `Could not parse JSON from chunk ${i + 1}. Content: ${content.substring(0, 50)}...`);
                    }
                } catch (err) {
                    logger.error('AI', `Error processing chunk ${i + 1}`, err);
                }
            }

            logger.info('AI', `Completed all chunks. Total patches found: ${allPatches.length}`);
            return allPatches;

        } catch (error) {
            logger.error('AI', 'Failed to review content', error);
            return [];
        }
    }
};
