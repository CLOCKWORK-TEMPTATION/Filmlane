'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { screenplayFormats, formatClassMap, A4_PAGE_HEIGHT_PX } from '@/constants';
import { EditorHeader } from './EditorHeader';
import { EditorToolbar } from './EditorToolbar';
import { EditorArea } from './EditorArea';
import { EditorFooter } from './EditorFooter';
import { EditorSidebar } from './EditorSidebar';
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

    const handleSave = () => {
        toast({
            title: "تم الحفظ",
            description: "تم حفظ المستند بنجاح",
        });
    };

    const handleDownload = () => {
        toast({
            title: "تم التحميل",
            description: "جاري تحضير الملف للتحميل",
        });
    };

    const handleHistory = () => {
        toast({
            title: "السجل",
            description: "عرض سجل التغييرات",
        });
    };

    const handleMessages = () => {
        toast({
            title: "الرسائل",
            description: "فتح نافذة الرسائل",
        });
    };

    const handleInfo = () => {
        toast({
            title: "المعلومات",
            description: "معلومات المستند الحالي",
        });
    };

    const handleLightbulb = () => {
        toast({
            title: "الأفكار",
            description: "اقتراحات وأفكار جديدة",
        });
    };

    const handleStethoscope = () => {
        toast({
            title: "الفحص",
            description: "فحص جودة السيناريو",
        });
    };

    const handleContentChange = useCallback(() => {
        if (editorRef.current) {
            setContent(editorRef.current.innerHTML);
        }
    }, []);

    const handleStatsChange = useCallback((stats: DocumentStats) => {
        setDocumentStats(stats);
    }, []);

    const handleFormatChange = useCallback((format: string) => {
        setCurrentFormat(format);
    }, []);

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
        // الحاوية الرئيسية مع الوضع الليلي/النهاري
        <div
            className={`min-h-screen flex flex-col h-screen font-sans transition-all duration-300 animate-fade-in ${
                isDarkMode ? 'dark bg-gray-900 text-white' : 'bg-white text-black'
            }`}
            dir="rtl"
        >
            <EditorHeader 
                onSave={handleSave}
                onDownload={handleDownload}
                onHistory={handleHistory}
                onInfo={handleInfo}
            />
            <div className="flex-grow flex overflow-hidden relative">
                {/* المنطقة الرئيسية مع التدرج اللوني */}
                <div className="flex-1 relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 overflow-auto">
                    {/* إضاءة محيطة خفيفة */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl"></div>
                    </div>
                    
                    {/* المحتوى الرئيسي */}
                    <div className="relative flex flex-col overflow-y-auto h-full">
                        <EditorToolbar
                            onFormatCommand={handleFormatCommand}
                        />
                        <div className="relative px-6 pb-6 pt-0 flex-1">
                            {/* حاوية الكتابة */}
                            <EditorArea
                                ref={editorRef}
                                onContentChange={handleContentChange}
                                onStatsChange={handleStatsChange}
                                onFormatChange={handleFormatChange}
                                font={selectedFont}
                                size={selectedSize}
                            />
                        </div>
                    </div>
                </div>

                {/* الشريط الجانبي */}
                <EditorSidebar 
                    onMessages={handleMessages}
                    onIdeas={handleLightbulb}
                    onCheck={handleStethoscope}
                />
            </div>
            <EditorFooter stats={documentStats} currentFormatLabel={screenplayFormats.find(f => f.id === currentFormat)?.label || ''} />
        </div>
    );
};
