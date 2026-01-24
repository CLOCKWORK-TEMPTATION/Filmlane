'use client';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from 'react';
import {
  handlePaste as newHandlePaste,
  PersistentMemoryManager,
  getFormatStyles,
  getNextFormatOnTab,
  getNextFormatOnEnter,
  type AIPayload,
  logger,
  applyPatches,
  reviewContent,
} from '@/utils';
import {
  formatClassMap,
  screenplayFormats,
  PAGE_HEIGHT_PX,
  HEADER_HEIGHT_PX,
  FOOTER_HEIGHT_PX,
  CONTENT_HEIGHT_PX,
} from '@/constants';
import type { DocumentStats, ClassificationSettings } from '@/types/screenplay';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { CorrectionFeedback } from './CorrectionFeedback';

export type EditorHandle = {
  insertContent: (content: string, mode?: 'insert' | 'replace') => void;
  getElement: () => HTMLDivElement | null; // Returns the container of pages
  getAllText: () => string; // Helper to get full text
};

type HoveredLineInfo = {
  id: string;
  text: string;
  type: string;
  confidence: number;
  rect: DOMRect;
};

type EditorAreaProps = {
  onContentChange: () => void;
  onStatsChange: (stats: DocumentStats) => void;
  onFormatChange: (format: string) => void;
  font: string;
  size: string;
  pageCount: number;
};

export const EditorArea = forwardRef<EditorHandle, EditorAreaProps>(
  ({ onContentChange, onStatsChange, onFormatChange, font, size, pageCount }, ref) => {
    const fixedFont = font || 'AzarMehrMonospaced-San';
    const fixedSize = size || '12pt';
    const containerRef = useRef<HTMLDivElement>(null);
    const [pages, setPages] = useState<number[]>([1]);
    const [hoveredLine, setHoveredLine] = useState<HoveredLineInfo | null>(null);
    const [classificationSettings, setClassificationSettings] = useState<ClassificationSettings>({
      llmThreshold: 5.0,
      autoConfirmThreshold: 8.0,
      learningEnabled: true,
    });
    const sessionId = useMemo(() => `session-${Date.now()}`, []);

    // Page metrics validation
    const pageMetrics = useMemo(
      () => ({
        pageHeight: PAGE_HEIGHT_PX,
        headerHeight: HEADER_HEIGHT_PX,
        footerHeight: FOOTER_HEIGHT_PX,
        contentHeight: CONTENT_HEIGHT_PX,
      }),
      [],
    );

    useEffect(() => {
      if (pageCount !== pages.length) {
        console.warn(`Page count sync: expected ${pageCount}, actual ${pages.length}`);
      }
    }, [pageCount, pages.length]);

    // Helper to get all content nodes from all pages
    const getAllContentNodes = () => {
      if (!containerRef.current) return [];
      const bodies = containerRef.current.querySelectorAll('.screenplay-sheet__body');
      const nodes: Element[] = [];
      bodies.forEach((body) => {
        Array.from(body.children).forEach((child) => nodes.push(child));
      });
      return nodes;
    };

    const isCurrentElementEmpty = () => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return true;
      const range = selection.getRangeAt(0);
      let currentElement = range.commonAncestorContainer;
      while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
        currentElement = currentElement.parentNode!;
      }
      while (
        currentElement &&
        (currentElement as HTMLElement).tagName !== 'DIV' &&
        (currentElement as HTMLElement).contentEditable !== 'true'
      ) {
        currentElement = currentElement.parentNode!;
      }
      if (!currentElement || (currentElement as HTMLElement).contentEditable === 'true')
        return true;
      return (currentElement.textContent || '').trim().length === 0;
    };

    const getCurrentFormat = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return 'action';
      let node = selection.getRangeAt(0).startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode!;
      }
      while (
        node &&
        node.parentNode &&
        (node.parentNode as HTMLElement).contentEditable !== 'true'
      ) {
        node = node.parentNode;
      }
      if (node && node instanceof HTMLElement && node.className) {
        const format = screenplayFormats.find((f) => node.classList.contains(formatClassMap[f.id]));
        if (format) return format.id;
      }
      return 'action';
    };

    const applyFormatToCurrentLine = (formatType: string) => {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      let currentElement = range.commonAncestorContainer;
      while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
        currentElement = currentElement.parentNode!;
      }
      while (
        currentElement &&
        (currentElement as HTMLElement).tagName !== 'DIV' &&
        (currentElement as HTMLElement).contentEditable !== 'true'
      ) {
        currentElement = currentElement.parentNode!;
      }
      if (!currentElement || (currentElement as HTMLElement).contentEditable === 'true') {
        document.execCommand('formatBlock', false, 'div');
        const newSelection = window.getSelection();
        if (!newSelection || !newSelection.rangeCount) return;
        currentElement = newSelection.getRangeAt(0).commonAncestorContainer;
        while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
          currentElement = currentElement.parentNode!;
        }
      }

      if (currentElement && currentElement instanceof HTMLElement) {
        Object.values(formatClassMap).forEach((cls) => currentElement.classList.remove(cls));
        currentElement.classList.add(formatClassMap[formatType]);

        const newRange = document.createRange();
        newRange.selectNodeContents(currentElement);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
        handleInput(); // Trigger update
      }
    };

    // The core repagination logic
    const repaginate = useCallback(() => {
      if (!containerRef.current) return;

      // 1. Collect all content nodes
      const nodes = getAllContentNodes();
      if (nodes.length === 0) return;

      // 2. Detach them (conceptually or actually)
      // We will move them, which detaches them from their current parent.

      // 3. We need to rebuild pages.
      // We'll reuse existing page elements to avoid flickering if possible, or force update state.
      // For DOM manipulation, we can just empty all bodies and refill them.

      // However, React state `pages` controls the NUMBER of pages rendered.
      // We need a way to manage this sync.
      // Strategy:
      // - Fill Page 1.
      // - If overflow, add content to Page 2 (create if needed).
      // - Use a temp document fragment or just direct DOM manipulation on the bodies.

      const bodies = Array.from(
        containerRef.current.querySelectorAll('.screenplay-sheet__body'),
      ) as HTMLElement[];

      // Ensure we have at least one body/page
      if (bodies.length === 0) return;

      let currentBodyIndex = 0;
      let currentBody = bodies[currentBodyIndex];
      let currentHeight = 0;

      // Clear all bodies first? No, that loses cursor position if we are strict.
      // Better: Iterate and move.

      // IMPORTANT: To preserve cursor, we shouldn't "remove and re-add" if it's already in the right place.
      // But for a full repaginate, it's easier to just re-flow.
      // Let's try a logic that moves nodes to where they fit.

      // We can't easily wait for React to render new pages if we need more.
      // So we might need to rely on "one extra empty page" always existing, or force DOM update.
      // OR: We update the React state `pages` after we calculate how many we need?
      // No, we need the DOM elements to exist to append to them.

      // Hybrid approach:
      // 1. Calculate needed pages based on height estimates? Hard without rendering.
      // 2. Just fill `currentBody`. When full, move to `bodies[next]`.
      //    If `bodies[next]` doesn't exist, we must update React state to add a page and wait?
      //    That breaks the synchronous loop.

      // Alternative: Just render a LOT of pages? No.

      // "Infinite Scroll" pattern:
      // If we fill the last page, triggering `setPages` to add one more.
      // Then dealing with the rest of nodes in the next effect.
      // This causes a "ripple" effect which is visible but acceptable for now.

      // Let's implement the "Fill current, if full move to next" logic.

      // First, clear all "future" bodies (from index+1 onwards) to ensure we refill them cleanly?
      // Or just iterate standardly.

      // Let's detach all nodes first to a list.
      const allNodes = [...nodes]; // Snapshot

      // Clear all bodies
      bodies.forEach((b) => (b.innerHTML = ''));

      // Refill
      currentBody = bodies[0];
      currentHeight = 0;
      currentBodyIndex = 0;

      let nodesBuffer: Element[] = [];

      for (let i = 0; i < allNodes.length; i++) {
        const node = allNodes[i] as HTMLElement;
        currentBody.appendChild(node); // Temporarily append to measure

        const nodeHeight =
          node.offsetHeight +
          parseInt(window.getComputedStyle(node).marginTop) +
          parseInt(window.getComputedStyle(node).marginBottom);

        // Allow a small tolerance
        if (currentHeight + nodeHeight > CONTENT_HEIGHT_PX - 20) {
          // 20px safety buffer
          // This node doesn't fit!
          // Move it to next page.

          // If this was the VERY FIRST node of the page, we have a problem (single node too big).
          // Screenplay lines are rarely that big. We'll ignore that edge case for now (allow it to overflow).
          if (currentHeight > 0) {
            currentBody.removeChild(node); // Take it back

            // Move to next page
            currentBodyIndex++;
            if (currentBodyIndex >= bodies.length) {
              // We ran out of pages!
              // We need to request more pages.
              // For this render cycle, we are stuck.
              // We will leave the remaining nodes in a buffer and trigger a state update.
              nodesBuffer = allNodes.slice(i);
              break;
            }

            currentBody = bodies[currentBodyIndex];
            currentBody.appendChild(node);
            currentHeight = nodeHeight;
          } else {
            // It fits because it has to (first node)
            currentHeight += nodeHeight;
          }
        } else {
          currentHeight += nodeHeight;
        }
      }

      // If we have leftover nodes, we need more pages.
      if (nodesBuffer.length > 0) {
        const averageHeight = currentHeight / (allNodes.length - nodesBuffer.length) || 100;
        const needed =
          Math.ceil((nodesBuffer.length * averageHeight) / pageMetrics.contentHeight) + 1;
        setPages((prev) => [
          ...prev,
          ...Array.from({ length: needed }, (_, k) => prev.length + 1 + k),
        ]);

        // We need to put the buffer SOMEWHERE so it's not lost before the next render.
        // Put them in the last available body for now (it will overflow, but better than disappearing).
        nodesBuffer.forEach((n) => currentBody.appendChild(n));
      } else {
        // If we utilized FEWER pages than we have (and the others are empty), we could remove them.
        // But let's keep it simple: keep empty pages or just remove trailing empty pages.
        if (currentBodyIndex < bodies.length - 1) {
          // We have excess pages.
          // Filter them out?
          // setPages(prev => prev.slice(0, currentBodyIndex + 1));
          // Be careful with setPages causing loops. Only do if diff is significant?
        }
      }
    }, [CONTENT_HEIGHT_PX, pageMetrics]);

    // Trigger repaginate on content changes
    const handleInput = useCallback(() => {
      onContentChange();
      // Debounce repaginate or run it?
      // Running it immediately might be heavy but "real-time" feels best.
      // Let's try requestAnimationFrame.
      requestAnimationFrame(repaginate);

      // Update stats
      if (containerRef.current) {
        const allText = getAllContentNodes()
          .map((n) => (n as HTMLElement).innerText)
          .join('\n');
        const words = allText.trim().split(/\s+/).filter(Boolean).length;
        const characters = allText.length;
        const scenes = containerRef.current.querySelectorAll('.format-scene-header-1').length;
        // Pages is effectively current pages count
        onStatsChange({ words, characters, pages: pages.length, scenes });
      }

      const format = getCurrentFormat();
      onFormatChange(format);
    }, [onContentChange, onStatsChange, onFormatChange, pages.length, repaginate]);

    useEffect(() => {
      if (typeof window === 'undefined') return;

      const loadSettings = () => {
        try {
          const raw = window.localStorage.getItem('filmlane_classification_settings');
          if (raw) {
            const parsed = JSON.parse(raw) as Partial<ClassificationSettings>;
            setClassificationSettings((prev) => ({ ...prev, ...parsed }));
          }
        } catch (error) {
          logger.warning('EditorArea', 'Failed to load classification settings', error);
        }
      };

      loadSettings();

      const handleSettingsUpdated = () => loadSettings();
      const handleStorage = (event: StorageEvent) => {
        if (event.key === 'filmlane_classification_settings') {
          loadSettings();
        }
      };

      window.addEventListener('filmlane-settings-updated', handleSettingsUpdated as EventListener);
      window.addEventListener('storage', handleStorage);
      return () => {
        window.removeEventListener(
          'filmlane-settings-updated',
          handleSettingsUpdated as EventListener,
        );
        window.removeEventListener('storage', handleStorage);
      };
    }, []);

    const memoryManager = useMemo(() => new PersistentMemoryManager(), []);

    const getLineType = (element: HTMLElement | null): string => {
      if (!element) return 'action';
      const formatClass = Array.from(element.classList).find((cls) => cls.startsWith('format-'));
      return formatClass ? formatClass.replace('format-', '') : 'action';
    };

    const resolveLineElement = useCallback((target: EventTarget | null): HTMLElement | null => {
      let node = target as HTMLElement | null;
      while (node && node !== containerRef.current) {
        if (node.classList && Array.from(node.classList).some((cls) => cls.startsWith('format-'))) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    }, []);

    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        const lineElement = resolveLineElement(event.target);
        if (!lineElement || !lineElement.id) {
          setHoveredLine(null);
          return;
        }

        const rect = lineElement.getBoundingClientRect();
        const confidence = Number(lineElement.dataset.confidence ?? 0);
        const lineInfo: HoveredLineInfo = {
          id: lineElement.id,
          text: lineElement.textContent || '',
          type: getLineType(lineElement),
          confidence,
          rect,
        };

        setHoveredLine((prev) =>
          prev?.id === lineInfo.id && prev.confidence === lineInfo.confidence ? prev : lineInfo,
        );
      },
      [resolveLineElement],
    );

    const handleMouseLeave = useCallback(() => {
      setHoveredLine(null);
    }, []);

    // Helper for handlePaste to find the "last child" across multiple pages
    const virtualEditorRef = useMemo(
      () => ({
        current: {
          get lastChild() {
            if (!containerRef.current) return null;
            const bodies = containerRef.current.querySelectorAll('.screenplay-sheet__body');
            if (bodies.length === 0) return null;
            return bodies[bodies.length - 1].lastChild;
          },
        } as unknown as HTMLDivElement,
      }),
      [],
    );

    const handleAIReviewNeeded = useCallback(
      async (payload: AIPayload) => {
        logger.info('EditorArea', '🧠 AI Correction Triggered', payload);

        try {
          // 1. Call AI Service
          const patches = await reviewContent(payload);

          if (patches.length > 0) {
            logger.info('EditorArea', `Applying ${patches.length} patches from AI.`);
            if (containerRef.current) {
              // 2. Apply Patches
              applyPatches(containerRef.current, patches);

              // 3. Trigger updates (stats, etc.)
              handleInput();

              // 4. Save Report (Background)
              if (payload.stats) {
                fetch('/api/ai-report', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    stats: payload.stats,
                    patchesCount: patches.length,
                  }),
                }).catch((err) => logger.error('EditorArea', 'Failed to save report', err));
              }
            }
          }
        } catch (error) {
          logger.error('EditorArea', 'AI Review Failed', error);
        }
      },
      [handleInput],
    );

    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLDivElement>) => {
        await newHandlePaste(
          e,
          virtualEditorRef,
          (formatType) => getFormatStyles(formatType, fixedSize, fixedFont),
          handleInput,
          memoryManager,
          sessionId,
          handleAIReviewNeeded,
        );
      },
      [handleInput, memoryManager, virtualEditorRef, handleAIReviewNeeded, sessionId],
    );

    const handleConfirmClassification = useCallback((lineId: string) => {
      if (!containerRef.current) return;
      const element = containerRef.current.querySelector(`[id="${lineId}"]`) as HTMLElement | null;
      if (element) {
        element.dataset.confidence = '10';
      }
    }, []);

    const handleCorrectClassification = useCallback(
      async (lineId: string, newType: string) => {
        if (!containerRef.current) return;
        const element = containerRef.current.querySelector(
          `[id="${lineId}"]`,
        ) as HTMLElement | null;
        const originalType = getLineType(element);
        const lineText = element?.textContent || '';
        const confidence = Number(element?.dataset.confidence ?? hoveredLine?.confidence ?? 0);

        applyPatches(containerRef.current, [
          { op: 'relabel', id: lineId, from: originalType, to: newType, index: 0 },
        ]);

        const updatedElement = containerRef.current.querySelector(
          `[id="${lineId}"]`,
        ) as HTMLElement | null;
        if (updatedElement) {
          updatedElement.dataset.confidence = String(Math.max(confidence, 9));
        }

        handleInput();

        if (hoveredLine) {
          setHoveredLine({
            ...hoveredLine,
            type: newType,
            confidence: Math.max(confidence, 9),
          });
        }

        try {
          await fetch('/api/classification/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              lineId,
              lineText,
              originalType,
              correctedType: newType,
              confidence,
            }),
          });
        } catch (error) {
          logger.error('EditorArea', 'Failed to submit correction feedback', error);
        }
      },
      [handleInput, hoveredLine, sessionId],
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const currentFormat = getCurrentFormat();
        const nextFormat = getNextFormatOnEnter(currentFormat);

        document.execCommand('insertParagraph');

        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          let parentElement = range.startContainer.parentElement;

          if (parentElement && parentElement.tagName !== 'DIV') {
            parentElement = parentElement.parentElement;
          }

          if (parentElement && parentElement.tagName === 'DIV') {
            Object.values(formatClassMap).forEach((cls) => parentElement.classList.remove(cls));
            parentElement.classList.add(formatClassMap[nextFormat]);

            range.selectNodeContents(parentElement);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
        handleInput();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        const currentFormat = getCurrentFormat();
        const isEmpty = isCurrentElementEmpty();
        const nextFormat = getNextFormatOnTab(currentFormat, isEmpty, e.shiftKey);
        if (nextFormat !== currentFormat) {
          applyFormatToCurrentLine(nextFormat);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        const formatKeys: Record<string, string> = {
          '1': 'scene-header-1',
          '2': 'character',
          '3': 'dialogue',
          '4': 'action',
          '6': 'transition',
        };
        if (formatKeys[key]) {
          e.preventDefault();
          applyFormatToCurrentLine(formatKeys[key]);
        }
      }
    };

    useEffect(() => {
      repaginate();
    }, [pages.length, repaginate]);

    // imperative handle
    useImperativeHandle(ref, () => ({
      insertContent: (content: string, mode: 'insert' | 'replace' = 'insert') => {
        // For replace, we clear everything and insert into page 1, then repaginate.
        if (mode === 'replace') {
          if (containerRef.current) {
            const bodies = containerRef.current.querySelectorAll('.screenplay-sheet__body');
            bodies.forEach((b) => (b.innerHTML = ''));
            if (bodies[0]) {
              bodies[0].innerHTML = content;
              // trigger repaginate
              repaginate();
              handleInput();
            }
          }
        } else {
          // Insert at cursor... complicated with multiple bodies.
          document.execCommand('insertHTML', false, content);
          handleInput();
        }
      },
      getElement: () => containerRef.current, // This might break logic expecting a single root with text.
      getAllText: () => {
        const nodes = getAllContentNodes();
        return nodes.map((n) => (n as HTMLElement).innerText).join('\n');
      },
    }));

    const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
    const badgeLeft = hoveredLine ? Math.max(12, hoveredLine.rect.left - 80) : 0;
    const badgeTop = hoveredLine ? hoveredLine.rect.top : 0;
    const feedbackLeft = hoveredLine
      ? Math.max(0, Math.min(viewportWidth - 120, hoveredLine.rect.right + 8))
      : 0;
    const feedbackTop = hoveredLine ? hoveredLine.rect.top : 0;

    return (
      <div className="relative">
        {hoveredLine && (
          <>
            <div
              className="fixed z-50 pointer-events-none"
              style={{ left: badgeLeft, top: badgeTop }}
            >
              <ConfidenceIndicator confidence={hoveredLine.confidence} show />
            </div>
            <div className="fixed z-50" style={{ left: feedbackLeft, top: feedbackTop }}>
              <CorrectionFeedback
                lineId={hoveredLine.id}
                lineText={hoveredLine.text}
                currentType={hoveredLine.type}
                confidence={hoveredLine.confidence}
                threshold={classificationSettings.autoConfirmThreshold}
                onConfirm={handleConfirmClassification}
                onCorrect={handleCorrectClassification}
              />
            </div>
          </>
        )}
        <div
          className="screenplay-container"
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {pages.map((pageId, index) => (
            <div key={pageId} className="screenplay-sheet">
              {/* Header */}
              <div className="screenplay-sheet__header">{/* Optional content for header */}</div>

              {/* Body */}
              <div
                className="screenplay-sheet__body"
                contentEditable={true}
                suppressContentEditableWarning={true}
                onInput={handleInput}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                onKeyUp={handleInput}
                onMouseUp={handleInput}
              />

              {/* Footer */}
              <div className="screenplay-sheet__footer">
                <div className="screenplay-page-number">{index + 1}.</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

EditorArea.displayName = 'EditorArea';
