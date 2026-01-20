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
import { formatClassMap, screenplayFormats, A4_PAGE_HEIGHT_PX } from '@/constants';
import { handlePaste as newHandlePaste, ContextMemoryManager, getFormatStyles, getNextFormatOnTab, getNextFormatOnEnter } from '@/utils';
import type { DocumentStats } from '@/types/screenplay';

export interface EditorHandle {
    insertContent: (content: string, mode?: 'insert' | 'replace') => void;
    getElement: () => HTMLDivElement | null;
}

interface EditorAreaProps {
    onContentChange: () => void;
    onStatsChange: (stats: DocumentStats) => void;
    onFormatChange: (format: string) => void;
    font: string;
    size: string;
    pageCount: number;
}

export const EditorArea = forwardRef<EditorHandle, EditorAreaProps>(({ onContentChange, onStatsChange, onFormatChange, font, size, pageCount }, ref) => {
    const fixedFont = 'AzarMehrMonospaced-San';
    const fixedSize = '12pt';
    const fixedLineHeight = '14pt';
    const memoryManager = useMemo(() => new ContextMemoryManager(), []);
    const internalRef = useRef<HTMLDivElement>(null);
    const [pageHeightPx, setPageHeightPx] = useState(A4_PAGE_HEIGHT_PX);
    const [pageNumberOffsetPx, setPageNumberOffsetPx] = useState(48);
    const totalPages = Math.max(1, pageCount || 1);
    const pageGapPx = 28;

    const measurePageMetrics = useCallback(() => {
        if (typeof window === 'undefined') return;

        const pageProbe = document.createElement('div');
        pageProbe.style.position = 'absolute';
        pageProbe.style.visibility = 'hidden';
        pageProbe.style.height = '297mm';
        pageProbe.style.width = '1px';

        const marginProbe = document.createElement('div');
        marginProbe.style.position = 'absolute';
        marginProbe.style.visibility = 'hidden';
        marginProbe.style.height = '0.5in';
        marginProbe.style.width = '1px';

        document.body.appendChild(pageProbe);
        document.body.appendChild(marginProbe);

        const measuredPageHeight = pageProbe.getBoundingClientRect().height;
        const measuredMargin = marginProbe.getBoundingClientRect().height;

        document.body.removeChild(pageProbe);
        document.body.removeChild(marginProbe);

        if (measuredPageHeight) setPageHeightPx(measuredPageHeight);
        if (measuredMargin) setPageNumberOffsetPx(measuredMargin);
    }, []);

    useEffect(() => {
        measurePageMetrics();
        window.addEventListener('resize', measurePageMetrics);
        return () => window.removeEventListener('resize', measurePageMetrics);
    }, [measurePageMetrics]);

    useImperativeHandle(ref, () => ({
        insertContent: (content: string, mode: 'insert' | 'replace' = 'insert') => {
            if (!internalRef.current) return;
            
            if (mode === 'replace') {
                internalRef.current.innerHTML = content;
                onContentChange();
            } else {
                internalRef.current.focus();
                document.execCommand('insertHTML', false, content);
                onContentChange();
            }
        },
        getElement: () => internalRef.current
    }));

    const isCurrentElementEmpty = () => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return true;
        const range = selection.getRangeAt(0);
        let currentElement = range.commonAncestorContainer;
        while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
            currentElement = currentElement.parentNode!;
        }
        while (currentElement && (currentElement as HTMLElement).tagName !== 'DIV' && (currentElement as HTMLElement).contentEditable !== 'true') {
            currentElement = currentElement.parentNode!;
        }
        if (!currentElement || (currentElement as HTMLElement).contentEditable === 'true') return true;
        return (currentElement.textContent || '').trim().length === 0;
    };

    const getCurrentFormat = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return 'action';
        let node = selection.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode!;
        }
        while (node && node.parentNode && (node.parentNode as HTMLElement).contentEditable !== 'true') {
            node = node.parentNode;
        }
        if (node && node instanceof HTMLElement && node.className) {
            const format = screenplayFormats.find(f => node.classList.contains(formatClassMap[f.id]));
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
        while (currentElement && (currentElement as HTMLElement).tagName !== 'DIV' && (currentElement as HTMLElement).contentEditable !== 'true') {
            currentElement = currentElement.parentNode!;
        }
        if (!currentElement || (currentElement as HTMLElement).contentEditable === 'true') {
            document.execCommand('formatBlock', false, 'div');
            const newSelection = window.getSelection();
            if(!newSelection || !newSelection.rangeCount) return;
            currentElement = newSelection.getRangeAt(0).commonAncestorContainer;
             while (currentElement && currentElement.nodeType !== Node.ELEMENT_NODE) {
                currentElement = currentElement.parentNode!;
            }
        }

        if (currentElement && currentElement instanceof HTMLElement) {
            Object.values(formatClassMap).forEach(cls => currentElement.classList.remove(cls));
            currentElement.classList.add(formatClassMap[formatType]);

            const newRange = document.createRange();
            newRange.selectNodeContents(currentElement);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
            onContentChange();
        }
    };

    const handleInteraction = useCallback(() => {
        onContentChange();
        
        if (internalRef.current) {
            const text = internalRef.current.innerText || '';
            const words = text.trim().split(/\s+/).filter(Boolean).length;
            const characters = text.length;
            const scenes = internalRef.current.querySelectorAll('.format-scene-header-1').length;
            const divisor = pageHeightPx || A4_PAGE_HEIGHT_PX;
            const pages = Math.max(1, Math.ceil(internalRef.current.scrollHeight / divisor));
            onStatsChange({ words, characters, pages, scenes });
        }

        const format = getCurrentFormat();
        onFormatChange(format);
    }, [onContentChange, onStatsChange, onFormatChange]);

    const handlePaste = useCallback(
        async (e: React.ClipboardEvent<HTMLDivElement>) => {
          if (!internalRef.current) return;
                    await newHandlePaste(e, internalRef, (formatType) => getFormatStyles(formatType, fixedSize, fixedFont), handleInteraction, memoryManager);
        },
                [handleInteraction, memoryManager],
      );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const currentFormat = getCurrentFormat();
            const nextFormat = getNextFormatOnEnter(currentFormat);

            document.execCommand('insertParagraph');

            const selection = window.getSelection();
            if(selection && selection.rangeCount > 0){
                const range = selection.getRangeAt(0);
                let parentElement = range.startContainer.parentElement;

                if (parentElement && parentElement.tagName !== 'DIV') {
                    parentElement = parentElement.parentElement;
                }

                if(parentElement && parentElement.tagName === "DIV"){
                    Object.values(formatClassMap).forEach(cls => parentElement.classList.remove(cls));
                    parentElement.classList.add(formatClassMap[nextFormat]);

                    range.selectNodeContents(parentElement);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
            handleInteraction();
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const currentFormat = getCurrentFormat();
            const isEmpty = isCurrentElementEmpty();
            const nextFormat = getNextFormatOnTab(currentFormat, isEmpty, e.shiftKey);
            if(nextFormat !== currentFormat) {
                applyFormatToCurrentLine(nextFormat);
            }
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            const key = e.key.toLowerCase();
            const formatKeys: {[key: string]: string} = {'1': 'scene-header-1', '2': 'character', '3': 'dialogue', '4': 'action', '6': 'transition'};
            if(formatKeys[key]){
                e.preventDefault();
                applyFormatToCurrentLine(formatKeys[key]);
            }
        }
    };

    return (
        <div className="flex-1 relative overflow-auto">
            <div className="flex justify-center py-8">
                <div className="relative w-full max-w-[calc(21cm+4rem)]">
                    <div
                        ref={internalRef}
                        contentEditable={true}
                        suppressContentEditableWarning={true}
                        className="screenplay-page focus:outline-none relative z-10"
                        onInput={handleInteraction}
                        onKeyUp={handleInteraction}
                        onMouseUp={handleInteraction}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        style={{
                            boxSizing: 'border-box',
                            fontFamily: `${fixedFont}, monospace`,
                            fontSize: fixedSize,
                            direction: 'rtl',
                            lineHeight: fixedLineHeight,
                            width: '210mm',
                            minHeight: '297mm',
                            margin: '0 auto',
                            paddingTop: '1in',
                            paddingBottom: '1in',
                            paddingRight: '1.5in',
                            paddingLeft: '1in',
                            backgroundColor: 'white',
                            color: 'black',
                            borderRadius: '0',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                            border: 'none',
                            outline: 'none',
                        }}
                    />
                    <div className="pointer-events-none absolute inset-0 z-30" aria-hidden="true">
                        {Array.from({ length: Math.max(0, totalPages - 1) }).map((_, index) => (
                            <div
                                key={`page-gap-${index + 1}`}
                                className="page-gap"
                                style={{
                                    top: `${(index + 1) * pageHeightPx - pageGapPx / 2}px`,
                                    height: `${pageGapPx}px`,
                                }}
                            />
                        ))}
                        {Array.from({ length: totalPages }).map((_, index) => (
                            <div
                                key={`page-number-${index + 1}`}
                                style={{
                                    position: 'absolute',
                                    top: `${index * pageHeightPx}px`,
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    width: '210mm',
                                    height: `${pageHeightPx}px`,
                                }}
                            >
                                <div
                                    className="page-number"
                                    style={{ bottom: `${pageNumberOffsetPx}px` }}
                                >
                                    {index + 1}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});

EditorArea.displayName = "EditorArea";
