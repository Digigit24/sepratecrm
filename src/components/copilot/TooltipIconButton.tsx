// src/components/copilot/TooltipIconButton.tsx
//
// Ported from the assistant-ui starter's `tooltip-icon-button.tsx`, retargeted
// from base-ui (`<TooltipTrigger render={...}>`) to this project's Radix-based
// shadcn tooltip (`<TooltipTrigger asChild>`). Used by WorkThread's action
// bars, branch picker, composer and MarkdownText's code-block header.

import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type TooltipIconButtonProps = ComponentPropsWithoutRef<typeof Button> & {
  tooltip: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
};

export const TooltipIconButton = forwardRef<HTMLButtonElement, TooltipIconButtonProps>(
  ({ children, tooltip, side = 'bottom', className, ...rest }, ref) => {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              {...rest}
              className={cn('size-6 p-1 active:scale-90', className)}
              ref={ref}
            >
              {children}
              <span className="sr-only">{tooltip}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side={side}>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

TooltipIconButton.displayName = 'TooltipIconButton';
