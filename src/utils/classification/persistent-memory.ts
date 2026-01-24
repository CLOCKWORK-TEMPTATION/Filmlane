import type { ContextMemory } from '@/types/screenplay';

export type PersistentMemory = {
  userId?: string;
  projectId?: string;
  scenes: {
    known: { number: string; description: string; firstSeen: number }[];
    currentScene?: string;
  };
  patterns: {
    userCorrections: {
      original: string;
      corrected: string;
      line: string;
      timestamp: number;
      confidence: number;
    }[];
    commonTransitions: { pattern: string; count: number }[];
  };
  settings: {
    llmThreshold: number;
    autoConfirmThreshold: number;
    learningEnabled: boolean;
  };
} & ContextMemory;

export class PersistentMemoryManager {
  private storage = new Map<string, PersistentMemory>();
  private readonly localStorageKey = 'filmlane_persistent_memory';

  async load(sessionId: string): Promise<PersistentMemory> {
    const stored = this.storage.get(sessionId);
    if (stored) {
      return JSON.parse(JSON.stringify(stored));
    }

    if (typeof window !== 'undefined') {
      try {
        const local = window.localStorage.getItem(`${this.localStorageKey}_${sessionId}`);
        if (local) {
          return JSON.parse(local) as PersistentMemory;
        }
      } catch (error) {
        console.warn('Failed to load persistent memory from localStorage', error);
      }
    }

    return {
      sessionId,
      lastModified: Date.now(),
      data: {
        commonCharacters: [],
        commonLocations: [],
        lastClassifications: [],
        characterDialogueMap: {},
      },
      scenes: { known: [] },
      patterns: { userCorrections: [], commonTransitions: [] },
      settings: {
        llmThreshold: 5.0,
        autoConfirmThreshold: 8.0,
        learningEnabled: true,
      },
    };
  }

  async save(sessionId: string, memory: PersistentMemory): Promise<void> {
    memory.lastModified = Date.now();
    this.storage.set(sessionId, JSON.parse(JSON.stringify(memory)));

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`${this.localStorageKey}_${sessionId}`, JSON.stringify(memory));
      } catch (error) {
        console.warn('Failed to save persistent memory to localStorage', error);
      }
    }
  }

  async recordCorrection(
    sessionId: string,
    line: string,
    originalType: string,
    correctedType: string,
    confidence: number,
  ): Promise<void> {
    const memory = await this.load(sessionId);
    memory.patterns.userCorrections.push({
      original: originalType,
      corrected: correctedType,
      line,
      timestamp: Date.now(),
      confidence,
    });
    await this.save(sessionId, memory);
  }

  async getSuggestions(sessionId: string, line: string): Promise<string[]> {
    const memory = await this.load(sessionId);
    const suggestions = new Set<string>();

    for (const correction of memory.patterns.userCorrections) {
      if (this.isSimilar(line, correction.line)) {
        suggestions.add(correction.corrected);
      }
    }

    return Array.from(suggestions);
  }

  private isSimilar(line1: string, line2: string): boolean {
    const words1 = new Set(line1.split(/\s+/));
    const words2 = new Set(line2.split(/\s+/));
    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    return intersection.size > 0;
  }
}

export const persistentMemoryManager = new PersistentMemoryManager();
