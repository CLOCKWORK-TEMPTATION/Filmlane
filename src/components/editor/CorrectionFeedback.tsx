'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

type CorrectionFeedbackProps = {
  lineId: string;
  lineText: string;
  currentType: string;
  confidence: number;
  threshold?: number;
  onConfirm: (lineId: string) => void;
  onCorrect: (lineId: string, newType: string) => void;
};

const FORMAT_TYPES = [
  { id: 'scene-header-top-line', label: 'ترويسة مشهد (رئيسية)' },
  { id: 'scene-header-1', label: 'ترويسة مشهد (رقم/مكان)' },
  { id: 'scene-header-2', label: 'ترويسة مشهد (وصف)' },
  { id: 'scene-header-3', label: 'ترويسة مشهد (تفاصيل)' },
  { id: 'action', label: 'وصف (Action)' },
  { id: 'character', label: 'شخصية' },
  { id: 'dialogue', label: 'حوار' },
  { id: 'parenthetical', label: 'ملاحظة تمثيل' },
  { id: 'transition', label: 'انتقال' },
];

export const CorrectionFeedback: React.FC<CorrectionFeedbackProps> = ({
  lineId,
  lineText,
  currentType,
  confidence,
  threshold = 6,
  onConfirm,
  onCorrect,
}) => {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(currentType);

  useEffect(() => {
    setSelectedType(currentType);
  }, [currentType]);

  if (confidence >= threshold) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-2 inline-flex items-center gap-1 text-yellow-500 hover:text-yellow-600 text-xs"
        title="طلب تصحيح التصنيف"
      >
        <span>⚠️</span>
        <span>تصحيح</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تصحيح التصنيف</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              السطر: &quot;{lineText.substring(0, 50)}...&quot;
            </p>

            <RadioGroup value={selectedType} onValueChange={setSelectedType}>
              {FORMAT_TYPES.map((format) => (
                <div key={format.id} className="flex items-center space-x-2 space-x-reverse">
                  <RadioGroupItem value={format.id} id={`${lineId}-${format.id}`} />
                  <Label htmlFor={`${lineId}-${format.id}`}>{format.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onConfirm(lineId);
                setOpen(false);
              }}
            >
              صحيح (تأكيد)
            </Button>
            <Button
              onClick={() => {
                onCorrect(lineId, selectedType);
                setOpen(false);
              }}
            >
              تصحيح إلى {FORMAT_TYPES.find((f) => f.id === selectedType)?.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
