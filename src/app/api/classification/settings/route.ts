import { NextResponse } from 'next/server';
import type { ClassificationSettings } from '@/types/screenplay';

const DEFAULT_SETTINGS: ClassificationSettings = {
  llmThreshold: 5.0,
  autoConfirmThreshold: 8.0,
  learningEnabled: true,
};

export async function GET(request: Request) {
  void request;
  return NextResponse.json(DEFAULT_SETTINGS);
}

export async function POST(request: Request) {
  try {
    const settings = (await request.json()) as Partial<ClassificationSettings>;
    return NextResponse.json({
      success: true,
      settings: { ...DEFAULT_SETTINGS, ...settings },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'خطأ غير متوقع' }, { status: 500 });
  }
}
