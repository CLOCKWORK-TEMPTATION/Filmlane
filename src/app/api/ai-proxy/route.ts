/**
 * AI Proxy Route
 * Proxies requests to vLLM server (Qwen2.5-14B)
 *
 * POST /api/ai-proxy
 * Authorization: Optional (configure in vLLM)
 */

import { NextResponse } from 'next/server';

const VLLM_API_URL = process.env.VLLM_API_URL || 'http://127.0.0.1:8000';
const VLLM_API_KEY = process.env.VLLM_API_KEY || '';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { model, prompt, max_tokens, temperature } = body as {
      model?: string;
      prompt: string;
      max_tokens?: number;
      temperature?: number;
    };

    console.log('📤 AI-Proxy: Forwarding to vLLM', { model, tokens: max_tokens });

    // ✅ إصلاح: استخدام API key من البيئة (أو بدون إذا مفعّل)
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // إضافة Authorization فقط إذا كان API key موجود
    if (VLLM_API_KEY) {
      headers['Authorization'] = `Bearer ${VLLM_API_KEY}`;
    }

    const response = await fetch(`${VLLM_API_URL}/v1/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: model || 'qwen25-14b',
        prompt,
        max_tokens: max_tokens || 1500,
        temperature: temperature ?? 0.3,
        stop: undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI-Proxy: vLLM error', response.status, errorText);
      return NextResponse.json(
        { error: `vLLM error: ${response.status} - ${errorText}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    console.log('✅ AI-Proxy: vLLM success');

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ AI-Proxy: Request failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
