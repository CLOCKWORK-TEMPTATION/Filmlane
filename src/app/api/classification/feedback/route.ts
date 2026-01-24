import { NextResponse } from 'next/server';
import { persistentMemoryManager } from '@/utils/classification/persistent-memory';

export async function POST(request: Request) {
  try {
    const { sessionId, lineId, lineText, originalType, correctedType, confidence } =
      await request.json();

    if (!sessionId || !lineText || !originalType || !correctedType) {
      return NextResponse.json({ error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    await persistentMemoryManager.recordCorrection(
      sessionId,
      lineText,
      originalType,
      correctedType,
      Number(confidence ?? 0),
    );

    return NextResponse.json({ success: true, lineId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'خطأ غير متوقع' },
      { status: 500 },
    );
  }
}
