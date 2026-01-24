import type { LucideIcon } from 'lucide-react';

export type ScreenplayFormat = {
  id: string;
  label: string;
  shortcut: string;
  color: string;
  icon: LucideIcon;
};

export type DocumentStats = {
  words: number;
  characters: number;
  pages: number;
  scenes: number;
};

export type FontOption = {
  value: string;
  label: string;
};

export type TextSizeOption = {
  value: string;
  label: string;
};

export type ClassificationRecord = {
  line: string;
  classification: string;
  timestamp: number;
  score?: number;
};

export type ClassificationSettings = {
  llmThreshold: number;
  autoConfirmThreshold: number;
  learningEnabled: boolean;
};

export type ClassificationFeedbackPayload = {
  sessionId: string;
  lineId: string;
  lineText: string;
  originalType: string;
  correctedType: string;
  confidence: number;
};

export type ContextMemory = {
  sessionId: string;
  lastModified: number;
  data: {
    commonCharacters: string[];
    commonLocations: string[];
    lastClassifications: string[];
    characterDialogueMap: Record<string, number>;
  };
};

export type LineContext = {
  previousLines: string[];
  currentLine: string;
  nextLines: string[];
  previousTypes: string[];
  stats: {
    wordCount: number;
    charCount: number;
    hasColon: boolean;
    hasPunctuation: boolean;
    startsWithBullet: boolean;
    isShort: boolean;
    isLong: boolean;
  };
  pattern: {
    isInDialogueBlock: boolean;
    isInSceneHeader: boolean;
    lastSceneDistance: number;
    lastCharacterDistance: number;
  };
};
