'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { screenplayFormats, formatClassMap, A4_PAGE_HEIGHT_PX } from '@/constants';
import { MessageSquare, Lightbulb, Stethoscope, Film, Camera, Pause, Scissors, Play } from 'lucide-react';
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
                                font={selectedFont}
                                size={selectedSize}
                                pageCount={documentStats.pages}
                            />
                        </div>
                    </div>
                </div>

                {/* الشريط الجانبي */}
                <div className="no-print sidebar w-64 border-l border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/60 backdrop-blur-xl">
                    <div className="p-4">
                        <div className="grid grid-cols-4 gap-2">
                            <button
                                onClick={handleMessages}
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="رسائل"
                            >
                                <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 rounded-xl transition-all duration-300"></div>
                                <MessageSquare className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 relative" />
                            </button>
                            <button
                                onClick={handleLightbulb}
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="أفكار"
                            >
                                <div className="absolute inset-0 bg-yellow-500/0 group-hover:bg-yellow-500/10 rounded-xl transition-all duration-300"></div>
                                <Lightbulb className="w-5 h-5 text-yellow-400 group-hover:text-yellow-300 relative" />
                            </button>
                            <button
                                onClick={handleStethoscope}
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="فحص"
                            >
                                <div className="absolute inset-0 bg-rose-500/0 group-hover:bg-rose-500/10 rounded-xl transition-all duration-300"></div>
                                <Stethoscope className="w-5 h-5 text-rose-400 group-hover:text-rose-300 relative" />
                            </button>

                            <button
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="فيلم"
                            >
                                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 rounded-xl transition-all duration-300"></div>
                                <Film className="w-5 h-5 text-blue-400 group-hover:text-blue-300 relative" />
                            </button>
                            <button
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="كاميرا"
                            >
                                <div className="absolute inset-0 bg-violet-500/0 group-hover:bg-violet-500/10 rounded-xl transition-all duration-300"></div>
                                <Camera className="w-5 h-5 text-violet-400 group-hover:text-violet-300 relative" />
                            </button>
                            <button
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="تشغيل"
                            >
                                <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 rounded-xl transition-all duration-300"></div>
                                <Play className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 relative" />
                            </button>
                            <button
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="إيقاف مؤقت"
                            >
                                <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/10 rounded-xl transition-all duration-300"></div>
                                <Pause className="w-5 h-5 text-amber-400 group-hover:text-amber-300 relative" />
                            </button>
                            <button
                                className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
                                title="مقص"
                            >
                                <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 rounded-xl transition-all duration-300"></div>
                                <Scissors className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 relative" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <EditorFooter stats={documentStats} currentFormatLabel={screenplayFormats.find(f => f.id === currentFormat)?.label || ''} />
        </div>
    );
};
