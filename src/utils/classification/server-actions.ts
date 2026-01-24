/**
 * Server Actions for llama.cpp Context Analysis
 * This file runs server-side only and bridges client components to llama.cpp
 */

'use server';

import { slidingContextManager } from './sliding-context.server';
import type { LineContext } from '@/types/screenplay';

/**
 * Server Action: Get expanded context with llama.cpp analysis
 * Can be called from client-side components
 */
export async function getContextAnalysis(
  lines: string[],
  types: string[],
  index: number,
): Promise<LineContext> {
  try {
    // Direct call to slidingContextManager with llama.cpp
    const context = await slidingContextManager.buildExpandedContext(lines, types, index);
    return context;
  } catch (error) {
    console.error('[Server Action] Context analysis failed:', error);
    // Fallback: return basic context without llama.cpp
    const currentLine = lines[index] || '';
    const WINDOW_SIZE = 3;

    const previousLines: string[] = [];
    for (let i = Math.max(0, index - WINDOW_SIZE); i < index; i++) {
      previousLines.push(lines[i] || '');
    }

    const nextLines: string[] = [];
    for (let i = index + 1; i < Math.min(lines.length, index + WINDOW_SIZE + 1); i++) {
      nextLines.push(lines[i] || '');
    }

    return {
      previousLines,
      currentLine,
      nextLines,
      previousTypes: types.slice(0, index),
      stats: {
        wordCount: currentLine.split(/\s+/).length,
        charCount: currentLine.length,
        hasColon: currentLine.includes(':'),
        hasPunctuation: /[.!?،؛]/.test(currentLine),
        startsWithBullet: /^[•·]/.test(currentLine),
        isShort: currentLine.length < 30,
        isLong: currentLine.length > 100,
      },
      pattern: {
        isInDialogueBlock: types
          .slice(-3)
          .some((t) => ['character', 'dialogue', 'parenthetical'].includes(t)),
        isInSceneHeader: types.slice(-1)[0]?.includes('scene-header') || false,
        lastSceneDistance: types
          .slice()
          .reverse()
          .findIndex((t) => t?.includes('scene-header')),
        lastCharacterDistance: types
          .slice()
          .reverse()
          .findIndex((t) => t === 'character'),
      },
    };
  }
}

/**
 * Server Action: Initialize llama.cpp model
 */
export async function initializeLlamaModel(
  modelPath: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await slidingContextManager.initialize(modelPath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Server Action: Check if model is ready
 */
export async function isModelReady(): Promise<{ ready: boolean; info?: any }> {
  const ready = slidingContextManager.isModelReady();
  const info = slidingContextManager.getModelInfo();
  return { ready, info };
}
