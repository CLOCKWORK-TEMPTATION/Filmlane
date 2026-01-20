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
    const isPaginatingRef = useRef(false);
    const [pageHeightPx, setPageHeightPx] = useState(A4_PAGE_HEIGHT_PX);
    const [headerPx, setHeaderPx] = useState(96);
    const [footerPx, setFooterPx] = useState(96);
    const [halfInchPx, setHalfInchPx] = useState(48);
    const totalPages = Math.max(1, pageCount || 1);
    const pageGapPx = 28;
    const pageStridePx = pageHeightPx + pageGapPx;

    const measurePageMetrics = useCallback(() => {
        if (typeof window === 'undefined') return;

        const pageProbe = document.createElement('div');
        pageProbe.style.position = 'absolute';
        pageProbe.style.visibility = 'hidden';
        pageProbe.style.height = '297mm';
        pageProbe.style.width = '1px';

        const inchProbe = document.createElement('div');
        inchProbe.style.position = 'absolute';
        inchProbe.style.visibility = 'hidden';
        inchProbe.style.height = '1in';
        inchProbe.style.width = '1px';

        const halfInchProbe = document.createElement('div');
        halfInchProbe.style.position = 'absolute';
        halfInchProbe.style.visibility = 'hidden';
        halfInchProbe.style.height = '0.5in';
        halfInchProbe.style.width = '1px';

        document.body.appendChild(pageProbe);
        document.body.appendChild(inchProbe);
        document.body.appendChild(halfInchProbe);

        const measuredPageHeight = pageProbe.getBoundingClientRect().height;
        const measuredInch = inchProbe.getBoundingClientRect().height;
        const measuredHalfInch = halfInchProbe.getBoundingClientRect().height;

        document.body.removeChild(pageProbe);
        document.body.removeChild(inchProbe);
        document.body.removeChild(halfInchProbe);

        if (measuredPageHeight) setPageHeightPx(measuredPageHeight);
        if (measuredInch) {
            setHeaderPx(measuredInch);
            setFooterPx(measuredInch);
        }
        if (measuredHalfInch) setHalfInchPx(measuredHalfInch);
    }, []);

    useEffect(() => {
        measurePageMetrics();
        window.addEventListener('resize', measurePageMetrics);
        return () => window.removeEventListener('resize', measurePageMetrics);
    }, [measurePageMetrics]);

    const applyPagination = useCallback(() => {
        if (isPaginatingRef.current) return;
        const editor = internalRef.current;
        if (!editor || typeof window === 'undefined') return;

        isPaginatingRef.current = true;

        const selection = window.getSelection();
        const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        editor.querySelectorAll('.page-break-spacer').forEach((node) => node.remove());

        const headerSpacer = document.createElement('div');
        headerSpacer.className = 'page-break-spacer page-break-spacer--header';
        headerSpacer.setAttribute('contenteditable', 'false');
        headerSpacer.style.height = `${headerPx}px`;
        editor.prepend(headerSpacer);

        const contentHeight = pageHeightPx - headerPx - footerPx;
        let cursor = 0;

        const getNodeHeight = (node: HTMLElement) => {
            const rect = node.getBoundingClientRect();
            const computed = window.getComputedStyle(node);
            const marginTop = parseFloat(computed.marginTop) || 0;
            const marginBottom = parseFloat(computed.marginBottom) || 0;
            return rect.height + marginTop + marginBottom;
        };

        const splitNodeToFit = (node: HTMLElement, availablePx: number): boolean => {
            if (node.childNodes.length !== 1 || node.firstChild?.nodeType !== Node.TEXT_NODE) return false;
            const originalText = node.textContent ?? '';
            if (!originalText.trim()) return false;

            let low = 0;
            let high = originalText.length;
            let best = 0;

            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                node.textContent = originalText.slice(0, mid);
                const height = getNodeHeight(node);
                if (height <= availablePx) {
                    best = mid;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }

            let cut = best;
            if (cut <= 0 || cut >= originalText.length) {
                node.textContent = originalText;
                return false;
            }

            const whitespaceIndex = originalText.lastIndexOf(' ', cut);
            if (whitespaceIndex > 0) cut = whitespaceIndex;

            if (cut <= 0 || cut >= originalText.length) {
                node.textContent = originalText;
                return false;
            }

            const headText = originalText.slice(0, cut).trimEnd();
            const tailText = originalText.slice(cut).trimStart();

            if (!headText || !tailText) {
                node.textContent = originalText;
                return false;
            }

            node.textContent = headText;
            const tailNode = node.cloneNode(true) as HTMLElement;
            tailNode.textContent = tailText;
            node.after(tailNode);
            return true;
        };

        let index = 0;
        while (index < editor.children.length) {
            const node = editor.children[index] as HTMLElement;
            if (node.classList.contains('page-break-spacer')) {
                index += 1;
                continue;
            }

            let lineHeight = getNodeHeight(node);

            if (lineHeight > contentHeight) {
                if (cursor > 0) {
                    const spacer = document.createElement('div');
                    spacer.className = 'page-break-spacer';
                    spacer.setAttribute('contenteditable', 'false');
                    const remaining = Math.max(0, contentHeight - cursor);
                    spacer.style.height = `${remaining + footerPx + pageGapPx + headerPx}px`;
                    editor.insertBefore(spacer, node);
                    cursor = 0;
                    continue;
                }

                const didSplit = splitNodeToFit(node, contentHeight);
                if (didSplit) {
                    lineHeight = getNodeHeight(node);
                    cursor += lineHeight;
                    index += 1;
                    continue;
                }

                // منع حلقة لا نهائية عندما يكون العنصر أطول من الصفحة ولا يمكن تقسيمه
                cursor = contentHeight;
                index += 1;
                continue;
            }

            if (cursor + lineHeight > contentHeight) {
                const spacer = document.createElement('div');
                spacer.className = 'page-break-spacer';
                spacer.setAttribute('contenteditable', 'false');
                const remaining = Math.max(0, contentHeight - cursor);
                spacer.style.height = `${remaining + footerPx + pageGapPx + headerPx}px`;
                editor.insertBefore(spacer, node);
                cursor = 0;
                continue;
            }

            cursor += lineHeight;
            index += 1;
        }

        const footerSpacer = document.createElement('div');
        footerSpacer.className = 'page-break-spacer page-break-spacer--footer';
        footerSpacer.setAttribute('contenteditable', 'false');
        footerSpacer.style.height = `${footerPx}px`;
        editor.appendChild(footerSpacer);

        if (range && selection && editor.contains(range.startContainer)) {
            selection.removeAllRanges();
            selection.addRange(range);
        }

        isPaginatingRef.current = false;
    }, [footerPx, headerPx, pageHeightPx, pageGapPx]);

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
            const divisor = pageStridePx || (A4_PAGE_HEIGHT_PX + pageGapPx);
            const pages = Math.max(1, Math.ceil((internalRef.current.scrollHeight + pageGapPx) / divisor));
            onStatsChange({ words, characters, pages, scenes });
        }

        const format = getCurrentFormat();
        onFormatChange(format);

        requestAnimationFrame(() => applyPagination());
    }, [applyPagination, onContentChange, onFormatChange, onStatsChange, pageGapPx, pageStridePx]);

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
                            paddingTop: '0',
                            paddingBottom: '0',
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
                    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
                        {Array.from({ length: totalPages }).map((_, index) => (
                            <div
                                key={`page-frame-${index + 1}`}
                                className="page-frame"
                                style={{
                                    top: `${index * pageStridePx}px`,
                                    height: `${pageHeightPx}px`,
                                }}
                            >
                                <div className="page-frame__inner" />
                            </div>
                        ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 z-5" aria-hidden="true">
                        {Array.from({ length: Math.max(0, totalPages - 1) }).map((_, index) => (
                            <div
                                key={`page-gap-${index + 1}`}
                                className="page-gap"
                                style={{
                                    top: `${(index + 1) * pageStridePx - pageGapPx / 2}px`,
                                    height: `${pageGapPx}px`,
                                }}
                            />
                        ))}
                    </div>
                    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
                        {Array.from({ length: totalPages }).map((_, index) => (
                            <div
                                key={`page-number-${index + 1}`}
                                className="page-frame"
                                style={{
                                    top: `${index * pageStridePx}px`,
                                    height: `${pageHeightPx}px`,
                                }}
                            >
                                <div
                                    className="page-number"
                                    style={{ bottom: `${halfInchPx}px` }}
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
