'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';

type ConfidenceIndicatorProps = {
  confidence: number;
  show?: boolean;
};

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  show = false,
}) => {
  if (!show) return null;

  const variant = confidence >= 7 ? 'default' : confidence >= 5 ? 'secondary' : 'destructive';

  return (
    <div className="pointer-events-none">
      <Badge variant={variant} className="text-xs shadow-md">
        {confidence.toFixed(1)}/10
      </Badge>
    </div>
  );
};
