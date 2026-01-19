import type { LucideIcon } from 'lucide-react';

export interface ScreenplayFormat {
  id: string;
  label: string;
  shortcut: string;
  color: string;
  icon: LucideIcon;
}

export interface DocumentStats {
  words: number;
  characters: number;
  pages: number;
  scenes: number;
}

export interface FontOption {
  value: string;
  label: string;
}

export interface TextSizeOption {
  value: string;
  label: string;
}

export interface ClassificationRecord {
  line: string;
  classification: string;
  timestamp: number;
}

export interface ContextMemory {
  sessionId: string;
  lastModified: number;
  data: {
    commonCharacters: string[];
    commonLocations: string[];
    lastClassifications: string[];
    characterDialogueMap: { [character: string]: number };
  };
}

export interface LineContext {
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
}
