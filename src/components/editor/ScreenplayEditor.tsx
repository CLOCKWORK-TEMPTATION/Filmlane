'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { screenplayFormats, formatClassMap, A4_PAGE_HEIGHT_PX } from '@/constants';
import { EditorHeader } from './EditorHeader';
import { EditorToolbar } from './EditorToolbar';
import { EditorArea } from './EditorArea';
import { EditorFooter } from './EditorFooter';
import { generateSceneIdeas } from '@/ai/flows/generate-scene-ideas';
import { autoFormatScreenplay } from '@/ai/flows/auto-format-screenplay';
import { useToast } from '@/hooks/use-toast';
import type { DocumentStats } from '@/types/screenplay';

export const ScreenplayEditor = () => {
    const { theme, setTheme } = useTheme();
    const isDarkMode = theme === 'dark';
    const [content, setContent] = useState('');
    const [currentFormat, setCurrentFormat] = useState('action');
    const [selectedFont, setSelectedFont] = useState('Amiri');
    const [selectedSize, setSelectedSize] = useState('14pt');
    const [documentStats, setDocumentStats] = useState<DocumentStats>({ words: 0, characters: 0, pages: 1, scenes: 0 });
    const [isProcessingAI, setIsProcessingAI] = useState(false);

    const editorRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const updateStats = useCallback(() => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText || '';
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        const characters = text.length;
        const scenes = editorRef.current.querySelectorAll('.format-scene-header-1').length;
        const pages = Math.max(1, Math.ceil(editorRef.current.scrollHeight / A4_PAGE_HEIGHT_PX));
        setDocumentStats({ words, characters, pages, scenes });
    }, []);

    const updateCurrentFormat = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let node = selection.getRangeAt(0).startContainer;
        if (node.nodeType === Node.TEXT_NODE) {
            node = node.parentNode!;
        }
        while (node && node.parentNode && node.parentNode !== editorRef.current) {
            node = node.parentNode;
        }
        if (node && node instanceof HTMLElement && node.className) {
            const format = screenplayFormats.find(f => node.classList.contains(formatClassMap[f.id]));
            if (format) {
                setCurrentFormat(format.id);
            }
        }
    }, []);

    const handleContentChange = useCallback(() => {
        if (editorRef.current) {
            setContent(editorRef.current.innerHTML);
            updateStats();
            updateCurrentFormat();
        }
    }, [updateStats, updateCurrentFormat]);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML === '') {
            const initialDiv = document.createElement('div');
            initialDiv.className = formatClassMap.action;
            initialDiv.innerHTML = '<br>';
            editorRef.current.appendChild(initialDiv);
            handleContentChange();
        }
    }, [handleContentChange]);

    const handleFormatCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
        handleContentChange();
    };

    const handleGenerateIdeas = async (theme: string) => {
        setIsProcessingAI(true);
        try {
            const result = await generateSceneIdeas({ theme });
            const ideasHtml = result.sceneIdeas.map(idea => `<div class="${formatClassMap.action}">${idea}</div>`).join('');
            document.execCommand('insertHTML', false, ideasHtml);
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "خطأ في إنشاء الأفكار",
                description: "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.",
            });
        } finally {
            setIsProcessingAI(false);
        }
    };

    const handleAutoFormat = async () => {
        if(!editorRef.current) return;
        const rawText = editorRef.current.innerText;
        if (!rawText.trim()) {
            toast({
                title: "لا يوجد نص للتنسيق",
                description: "اكتب شيئًا في المحرر أولاً.",
            });
            return;
        }

        setIsProcessingAI(true);
        try {
            const result = await autoFormatScreenplay({ rawText });

            const lines = result.formattedScreenplay.split('\n').filter(line => line.trim() !== '');
            let htmlToInsert = '';

            lines.forEach(line => {
                let formatClass = formatClassMap.action;
                const upperCaseLine = line.toUpperCase();
                if (upperCaseLine.startsWith('INT.') || upperCaseLine.startsWith('EXT.')) {
                    formatClass = formatClassMap['scene-header-1'];
                } else if (line.trim().match(/^[A-Z\s]+$/) && line.length < 35 && !line.includes('(')) {
                     formatClass = formatClassMap.character;
                } else if (line.startsWith('(') && line.endsWith(')')) {
                    formatClass = formatClassMap.parenthetical;
                }

                htmlToInsert += `<div class="${formatClass}">${line}</div>`;
            });

            editorRef.current.innerHTML = htmlToInsert;
            handleContentChange();

            toast({
                title: "تم التنسيق بنجاح",
                description: "تم تنسيق النص بواسطة الذكاء الاصطناعي.",
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "خطأ في التنسيق",
                description: "حدث خطأ أثناء محاولة تنسيق النص.",
            });
        } finally {
            setIsProcessingAI(false);
        }
    };

    return (
        <div className={`flex flex-col h-screen font-body transition-colors duration-300`}>
            <EditorHeader onGenerateIdeas={handleGenerateIdeas} isProcessingAI={isProcessingAI}/>
            <div className="flex-grow flex overflow-hidden">
                <div className="flex-grow flex flex-col overflow-y-auto">
                    <EditorToolbar
                        currentFormat={currentFormat}
                        setCurrentFormat={setCurrentFormat}
                        selectedFont={selectedFont}
                        setSelectedFont={setSelectedFont}
                        selectedSize={selectedSize}
                        setSelectedSize={setSelectedSize}
                        onFormatCommand={handleFormatCommand}
                        onAutoFormat={handleAutoFormat}
                        isProcessingAI={isProcessingAI}
                    />
                    <EditorArea
                        ref={editorRef}
                        onContentChange={handleContentChange}
                        font={selectedFont}
                        size={selectedSize}
                        pageCount={documentStats.pages}
                    />
                </div>
            </div>
            <EditorFooter stats={documentStats} currentFormatLabel={screenplayFormats.find(f => f.id === currentFormat)?.label || ''} />
        </div>
    );
};
