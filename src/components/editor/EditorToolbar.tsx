'use client';
import {
    Info, Undo2, Bold, Italic, AlignRight, AlignCenter,
    Film, Camera, Play, Pause, Scissors, Upload, FileText
} from 'lucide-react';
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface EditorToolbarProps {
    onFormatCommand: (command: string, value?: string) => void;
}

export function EditorToolbar({ onFormatCommand }: EditorToolbarProps) {
    return (
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b p-2">
            <div className="w-full max-w-[calc(21cm+4rem)] mx-auto">
                <div className="p-2 rounded-md border bg-card flex items-center justify-center gap-3 overflow-x-auto" style={{ direction: 'rtl' }}>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="group p-2 rounded-lg hover:bg-white/10 transition-all" title="Info">
                                    <Info className="w-5 h-5 text-sky-400 group-hover:text-sky-300" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>معلومات</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button className="group p-2 rounded-lg hover:bg-white/10 transition-all" title="Undo">
                                    <Undo2 className="w-5 h-5 text-slate-400 group-hover:text-slate-300" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>تراجع</p></TooltipContent>
                        </Tooltip>

                        <Separator orientation="vertical" className="h-6 bg-white/10" />

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onFormatCommand('bold')}
                                    className="group p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all"
                                    title="عريض"
                                >
                                    <Bold size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>عريض</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onFormatCommand('italic')}
                                    className="group p-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 hover:text-violet-300 transition-all"
                                    title="مائل"
                                >
                                    <Italic size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>مائل</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onFormatCommand('justifyRight')}
                                    className="group p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-all"
                                    title="محاذاة يمين"
                                >
                                    <AlignRight size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>محاذاة يمين</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => onFormatCommand('justifyCenter')}
                                    className="group p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 transition-all"
                                    title="توسيط"
                                >
                                    <AlignCenter size={18} />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent><p>توسيط</p></TooltipContent>
                        </Tooltip>

                        <Separator orientation="vertical" className="h-6 bg-white/10" />

                        <button className="group p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 transition-all" title="Film">
                            <Film size={18} />
                        </button>
                        <button className="group p-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 hover:text-violet-300 transition-all" title="Camera">
                            <Camera size={18} />
                        </button>
                        <button className="group p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 transition-all" title="Pause">
                            <Pause size={18} />
                        </button>
                        <button className="group p-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 transition-all" title="Scissors">
                            <Scissors size={18} />
                        </button>
                        <button className="group p-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-all" title="Upload">
                            <Upload size={18} />
                        </button>
                        <button className="group p-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 transition-all" title="File">
                            <FileText size={18} />
                        </button>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}
