import { NextResponse } from 'next/server';
import { slidingContextManager } from '@/utils/classification/sliding-context.server';

export async function GET() {
  const info = slidingContextManager.getModelInfo();

  return NextResponse.json({
    nodeLlamaCpp: {
      available: typeof require !== 'undefined' ? 'YES (server-side)' : 'NO (client-side)',
      moduleLoaded: info.loaded,
      modelPath: info.path,
      cacheSize: info.cacheSize,
    },
    test: {
      message: 'node-llama-cpp module status',
      tip: 'Call POST /api/test-llama/init to test model loading',
    },
  });
}

export async function POST(request: Request) {
  try {
    const { modelPath } = await request.json();

    console.log('🧪 Testing node-llama-cpp initialization...');

    await slidingContextManager.initialize(modelPath);

    return NextResponse.json({
      success: true,
      message: 'Model loaded successfully!',
      modelInfo: slidingContextManager.getModelInfo(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 },
    );
  }
}
