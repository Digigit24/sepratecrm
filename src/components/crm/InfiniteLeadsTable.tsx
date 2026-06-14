// src/components/crm/InfiniteLeadsTable.tsx
// Infinite-scroll table for CRM leads — fetches 100 at a time as the user scrolls.
// Mirrors DataTable's column/row-action interface so it's a drop-in for list view.
import { useRef, useEffect, useCallback } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DataTableColumn } from '@/components/DataTable';
import type { Lead } from '@/types/crmTypes';

interface InfiniteLeadsTableProps {
  /** All accumulated leads across pages */
  leads: Lead[];
  isLoading: boolean;
  /** True when there's a next page available */
  hasMore: boolean;
  /** Call this to load the next page */
  onLoadMore: () => void;
  /** True when the next page is currently fetching */
  isFetchingMore: boolean;
  /** Total count from API */
  totalCount: number;

  columns: DataTableColumn<Lead>[];
  selectedIds: Set<number>;
  onToggleSelect: (lead: Lead) => void;
  onToggleSelectAll: (leads: Lead[]) => void;
  onView?: (lead: Lead) => void;
  onEdit?: (lead: Lead) => void;
  onDelete?: (lead: Lead) => void;
  renderInlineActions?: (lead: Lead) => React.ReactNode;
  rowClassName?: (lead: Lead) => string;
}

export function InfiniteLeadsTable({
  leads,
  isLoading,
  hasMore,
  onLoadMore,
  isFetchingMore,
  totalCount,
  columns,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEdit,
  onDelete,
  renderInlineActions,
  rowClassName,
}: InfiniteLeadsTableProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver: trigger loadMore when sentinel enters viewport
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' } // start fetching 200px before the bottom
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, onLoadMore]);

  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));
  const someSelected = leads.some((l) => selectedIds.has(l.id));

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLoading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No leads found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Count bar */}
      <div className="px-4 py-2 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Showing <span className="font-medium text-foreground">{leads.length.toLocaleString()}</span>
          {' '}of{' '}
          <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span> leads
        </span>
        {selectedIds.size > 0 && (
          <span className="text-primary font-medium">{selectedIds.size} selected</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 px-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => onToggleSelectAll(leads)}
                  aria-label="Select all"
                  className={someSelected && !allSelected ? 'opacity-50' : ''}
                />
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {leads.map((lead) => {
              const isSelected = selectedIds.has(lead.id);
              const extraClass = rowClassName?.(lead) ?? '';
              return (
                <TableRow
                  key={lead.id}
                  className={`group cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : ''} ${extraClass}`}
                  onClick={() => onView?.(lead)}
                >
                  {/* Checkbox */}
                  <TableCell className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(lead)}
                      aria-label={`Select ${lead.name}`}
                    />
                  </TableCell>

                  {/* Data columns */}
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(lead)}
                    </TableCell>
                  ))}

                  {/* Actions */}
                  <TableCell className="w-24 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {/* Inline icon actions (visible on hover) */}
                      <div className="hidden group-hover:flex items-center gap-1">
                        {renderInlineActions?.(lead)}
                      </div>

                      {/* 3-dot dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onView && (
                            <DropdownMenuItem onClick={() => onView(lead)}>
                              <Eye className="h-4 w-4 mr-2" /> View
                            </DropdownMenuItem>
                          )}
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(lead)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          {onDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(lead)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Sentinel + loader */}
      <div ref={sentinelRef} className="h-1" />
      {isFetchingMore && (
        <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading more leads…
        </div>
      )}
      {!hasMore && leads.length > 0 && (
        <div className="flex items-center justify-center py-4 text-xs text-muted-foreground border-t border-border/40">
          All {totalCount.toLocaleString()} leads loaded
        </div>
      )}
    </div>
  );
}
