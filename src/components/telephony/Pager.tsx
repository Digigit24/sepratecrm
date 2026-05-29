// src/components/telephony/Pager.tsx
// Server-side pagination footer: "Showing X–Y of N" + Prev/Next.
// Renders nothing when everything fits on one page.
import React from 'react';
import { Button } from '@/components/ui/button';

export interface PagerProps {
  page: number;
  pageSize: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
  /** Hide automatically when count <= pageSize (default true). */
  autoHide?: boolean;
}

export const Pager: React.FC<PagerProps> = ({
  page,
  pageSize,
  count,
  onPrev,
  onNext,
  autoHide = true,
}) => {
  if (autoHide && count <= pageSize) return null;
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  return (
    <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground">
      <span>
        Showing {from}–{to} of {count}
      </span>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={page <= 1}
          onClick={onPrev}
        >
          Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          disabled={to >= count}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default Pager;
