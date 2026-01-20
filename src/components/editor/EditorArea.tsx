'use client';
import React, { forwardRef, useCallback, useRef, useMemo, useImperativeHandle } from 'react';
import { formatClassMap, screenplayFormats } from '@/constants';
import { handlePaste as newHandlePaste, ContextMemoryManager, getFormatStyles, getNextFormatOnTab, getNextFormatOnEnter } from '@/utils';

export interface EditorHandle {
    insertContent: (content: string, mode?: 'insert' | 'replace') => void;
    getElement: () => HTMLDivElement | null;
}

interface EditorAreaProps {
    onContentChange: () => void;
    font: string;
    size: string;
    pageCount: number;
}

export const EditorArea = forwardRef<EditorHandle, EditorAreaProps>(({ onContentChange, font, size, pageCount }, ref) => {
    const memoryManager = useMemo(() => new ContextMemoryManager(), []);
    const internalRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        insertContent: (content: string, mode: 'insert' | 'replace' = 'insert') => {
            if (!internalRef.current) return;
            
            if (mode === 'replace') {
                internalRef.current.innerHTML = content;
                onContentChange();
            } else {
                internalRef.current.focus();
                document.execCommand('insertHTML', false, content);
                // execCommand triggers input events normally, but we ensure stats update
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


    const handlePaste = useCallback(
        async (e: React.ClipboardEvent<HTMLDivElement>) => {
          if (!internalRef.current) return;
          await newHandlePaste(e, internalRef, (formatType) => getFormatStyles(formatType, size, font), onContentChange, memoryManager);
        },
        [size, font, onContentChange, memoryManager],
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
            onContentChange();
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
                        onInput={onContentChange}
                        onKeyUp={onContentChange}
                        onMouseUp={onContentChange}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        style={{
                            boxSizing: 'border-box',
                            fontFamily: `${font}, 'PT Sans', sans-serif`,
                            fontSize: size,
                            direction: 'rtl',
                            lineHeight: '14pt',
                            width: '210mm',
                            minHeight: '297mm',
                            margin: '0 auto',
                            paddingTop: '1in',
                            paddingBottom: '0.5in',
                            paddingRight: '1.5in',
                            paddingLeft: '1in',
                            backgroundColor: 'white',
                            color: 'black',
                            borderRadius: '16px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
});

EditorArea.displayName = "EditorArea";

