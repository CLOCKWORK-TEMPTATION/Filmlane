/**
 * LFM2.5 Thinking Model Integration
 *
 * Service for classifying screenplay lines using LiquidAI/LFM2.5-1.2B-Thinking
 *
 * Usage:
 * ```ts
 * import { lfmClassifier } from '@/utils/classification/lfm-classifier';
 *
 * const result = await lfmClassifier.classify("يدخل أحمد", "مشهد 1", "scene-header");
 * console.log(result.type); // "action"
 * ```
 */

import { logger } from '../logger';

export type LFMClassificationRequest = {
  line: string;
  context?: string;
  previousType?: string;
  sceneContext?: string;
};

export type LFMClassificationResponse = {
  type: string;
  confidence: number;
  reasoning?: string;
};

export type LFMBatchRequest = {
  lines: string[];
  context?: string[];
};

export type LFMBatchResponse = {
  results: LFMClassificationResponse[];
};

const LFM_API_ENDPOINT = '/api/lfm-proxy';

/**
 * LFM2.5 Classifier Service
 */
export class LFMClassifier {
  private enabled = true;
  private timeout = 30000; // 30 seconds

  /**
   * Classify a single screenplay line
   */
  async classify(
    line: string,
    context?: string,
    previousType?: string,
  ): Promise<LFMClassificationResponse> {
    if (!this.enabled) {
      throw new Error('LFM classifier is disabled');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(LFM_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
        body: JSON.stringify({
          line,
          context,
          previous_type: previousType,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LFM classification failed: ${error}`);
      }

      const result: LFMClassificationResponse = await response.json();

      const duration = Date.now() - startTime;
      logger.info('LFM', `Classified in ${duration}ms`, {
        line: line.substring(0, 30),
        result: result.type,
      });

      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.error('LFM', 'Request timeout');
        throw new Error('LFM classification timeout');
      }
      throw error;
    }
  }

  /**
   * Classify multiple lines in a single request
   */
  async classifyBatch(lines: string[], context?: string[]): Promise<LFMClassificationResponse[]> {
    if (!this.enabled) {
      throw new Error('LFM classifier is disabled');
    }

    const startTime = Date.now();

    try {
      const response = await fetch(`${LFM_API_ENDPOINT}/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout * lines.length), // More time for batches
        body: JSON.stringify({
          lines,
          context,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LFM batch classification failed: ${error}`);
      }

      const result: LFMBatchResponse = await response.json();

      const duration = Date.now() - startTime;
      logger.info('LFM', `Batch classified ${lines.length} lines in ${duration}ms`);

      return result.results;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.error('LFM', 'Batch request timeout');
        throw new Error('LFM batch classification timeout');
      }
      throw error;
    }
  }

  /**
   * Check if LFM server is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8001/', {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Enable or disable the classifier
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logger.info('LFM', `Classifier ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set request timeout
   */
  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
}

// Singleton instance
export const lfmClassifier = new LFMClassifier();
