// src/components/calendar/CalendarEmptyState.tsx
import type { ReactNode } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarEmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * The house empty state: 48px muted icon, `text-sm font-medium` title,
 * `text-sm text-muted-foreground` body (UI_PRINCIPLES.md).
 */
export function CalendarEmptyState({
  title = 'Nothing scheduled',
  description = 'Click any empty slot to create an event.',
  action,
  className,
}: CalendarEmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-4 text-center', className)}>
      <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" strokeWidth={1.25} />
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export default CalendarEmptyState;
