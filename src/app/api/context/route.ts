/**
 * Context API Route
 * Uses Gemini 2.5 Flash-Lite via Genkit AI for context analysis
 *
 * POST /api/context
 * Body: { lines: string[], types: string[], index: number }
 */

import { NextResponse } from 'next/server';
import { slidingContextManager } from '@/utils/classification/sliding-context.server';

// ✅ تحميل النموذج مرة واحدة عند بدء التشغيل
let initialized = false;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

async function ensureModelInitialized() {
  if (!initialized) {
    try {
      // console.log('📥 Initializing Gemini 2.5 Flash-Lite...');
      await slidingContextManager.initialize(GOOGLE_API_KEY);
      initialized = true;
      // console.log('✅ Gemini initialized successfully!');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      // console.error('❌ Failed to initialize Gemini:', msg);
      throw new Error(`Gemini initialization failed: ${msg}`);
    }
  }
}

export async function POST(request: Request) {
  try {
    // ✅ تأكد من تحميل النموذج
    await ensureModelInitialized();

    const body = await request.json();
    const { lines, types, index } = body as {
      lines: string[];
      types: string[];
      index: number;
    };

    // ✅ بناء السياق
    const context = await slidingContextManager.buildExpandedContext(lines, types, index);

    return NextResponse.json({
      success: true,
      context,
      modelInfo: slidingContextManager.getModelInfo(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    // console.error('❌ Context API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        details: stack,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/context - فحص حالة النموذج
 */
export async function GET() {
  return NextResponse.json({
    initialized,
    modelInfo: slidingContextManager.getModelInfo(),
  });
}

// ✅ Cleanup عند إغلاق الـ server
if (typeof process !== 'undefined') {
  process.on('SIGTERM', async () => {
    // console.log('📤 Shutting down model...');
    await slidingContextManager.unload();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    // console.log('📤 Shutting down model...');
    await slidingContextManager.unload();
    process.exit(0);
  });
}
