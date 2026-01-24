'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Settings } from 'lucide-react';
import type { ClassificationSettings } from '@/types/screenplay';
import { logger } from '@/utils';

const DEFAULT_SETTINGS: ClassificationSettings = {
  llmThreshold: 5.0,
  autoConfirmThreshold: 8.0,
  learningEnabled: true,
};

const SETTINGS_KEY = 'filmlane_classification_settings';

export const ClassificationSettingsDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<ClassificationSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ClassificationSettings>;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      logger.warning('ClassificationSettings', 'Failed to load settings', error);
    }
  }, []);

  const handleSave = async () => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      window.dispatchEvent(new Event('filmlane-settings-updated'));
    } catch (error) {
      logger.warning('ClassificationSettings', 'Failed to save settings', error);
    }

    try {
      await fetch('/api/classification/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
    } catch (error) {
      logger.warning('ClassificationSettings', 'Failed to persist settings', error);
    }

    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 ml-2" />
          إعدادات التصنيف
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إعدادات التصنيف الذكي</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>حد استخدام الذكاء الاصطناعي: {settings.llmThreshold}</Label>
            <Slider
              value={[settings.llmThreshold]}
              onValueChange={([v]) => setSettings((s) => ({ ...s, llmThreshold: v }))}
              min={0}
              max={10}
              step={0.5}
              className="dir-rtl"
            />
            <p className="text-xs text-muted-foreground">
              استخدم الذكاء الاصطناعي فقط عندما تكون الثقة أقل من هذا الحد
            </p>
          </div>

          <div className="space-y-2">
            <Label>التأكيد التلقائي: {settings.autoConfirmThreshold}</Label>
            <Slider
              value={[settings.autoConfirmThreshold]}
              onValueChange={([v]) => setSettings((s) => ({ ...s, autoConfirmThreshold: v }))}
              min={0}
              max={10}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              لا تطلب تأكيداً عندما تكون الثقة أعلى من هذا الحد
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label>التعلم من التصحيحات</Label>
            <Switch
              checked={settings.learningEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, learningEnabled: v }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave}>حفظ الإعدادات</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
