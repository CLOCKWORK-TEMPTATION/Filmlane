import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stats, patchesCount } = body;

    const logEntry = {
      timestamp: new Date().toISOString(),
      stats,
      patchesCount,
    };

    // Create logs directory in project root if not exists
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    const logFile = path.join(logDir, 'ai-reports.jsonl');

    // Append as a new line
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save AI report', error);
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
  }
}
