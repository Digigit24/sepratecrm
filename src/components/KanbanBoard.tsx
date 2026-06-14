// src/components/KanbanBoard.tsx
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Plus, Settings, Phone, MessageCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import useSWRInfinite from 'swr/infinite';
import type { Lead, LeadStatus } from '@/types/crmTypes';
import type { LeadsQueryParams, LeadsResponse } from '@/types/crmTypes';
import { crmService } from '@/services/crmService';

const KANBAN_PAGE_SIZE = 30;

// Per-column infinite scroll hook
function useKanbanColumn(statusId: number, filterParams: Omit<LeadsQueryParams, 'page' | 'page_size' | 'status'>) {
  return useSWRInfinite<LeadsResponse>(
    (pageIndex, prev) => {
      if (prev && !prev.next) return null;
      return ['kanban-col', statusId, { ...filterParams, status: statusId, page: pageIndex + 1, page_size: KANBAN_PAGE_SIZE }];
    },
    ([_k, _sid, params]) => crmService.getLeads(params as LeadsQueryParams),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      revalidateFirstPage: false,
      persistSize: false,
    }
  );
}

interface KanbanColumnInfiniteProps {
  status: LeadStatus;
  filterParams: Omit<LeadsQueryParams, 'page' | 'page_size' | 'status'>;
  onViewLead: (lead: Lead) => void;
  onCallLead?: (lead: Lead) => void;
  onWhatsAppLead?: (lead: Lead) => void;
  onCreateLead: (statusId?: number) => void;
  onEditStatus: (status: LeadStatus) => void;
  onDeleteStatus: (status: LeadStatus) => void;
  onMoveStatus: (status: LeadStatus, direction: 'up' | 'down') => void;
  hexToRgba: (hex: string, alpha: number) => string;
  // For drag-and-drop: override displayed leads (for optimistic moves)
  overrideLeads?: Lead[] | null;
  onLeadsLoaded?: (statusId: number, leads: Lead[]) => void;
}

const KanbanColumnInfinite: React.FC<KanbanColumnInfiniteProps> = ({
  status,
  filterParams,
  onViewLead,
  onCallLead,
  onWhatsAppLead,
  onCreateLead,
  onEditStatus,
  onDeleteStatus,
  onMoveStatus,
  hexToRgba,
  overrideLeads,
  onLeadsLoaded,
}) => {
  const { data: pages, isLoading, isValidating, size, setSize, mutate } = useKanbanColumn(status.id, filterParams);

  const leads = useMemo(() => {
    const seen = new Set<number>();
    return (pages ?? []).flatMap((p) => p.results).filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
  }, [pages]);
  const totalCount = pages?.[0]?.count ?? 0;
  const hasMore = !!pages?.[pages.length - 1]?.next;
  const isFetchingMore = isValidating && (pages?.length ?? 0) > 0 && !isLoading;

  // Notify parent of loaded leads (for drag-and-drop state)
  useEffect(() => {
    if (!isLoading && leads.length >= 0) {
      onLeadsLoaded?.(status.id, leads);
    }
  }, [leads, isLoading, status.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && !isValidating) setSize((s) => s + 1); },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isValidating, setSize]);

  const displayedLeads = overrideLeads ?? leads;

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[280px] md:min-w-[320px] md:max-w-[320px]">
      {/* Column Header */}
      <div className="flex-shrink-0 mb-4">
        <div
          className="rounded-lg px-3 py-2 border"
          style={{
            backgroundColor: hexToRgba(status.color_hex || '#6B7280', 0.15),
            borderColor: status.color_hex || '#6B7280',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color_hex || '#6B7280' }} />
              <h3 className="font-semibold text-sm" style={{ color: status.color_hex || '#6B7280' }}>
                {status.name}
              </h3>
              {status.is_won && (
                <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded">Won</span>
              )}
              {status.is_lost && (
                <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">Lost</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: status.color_hex || '#6B7280' }}>
                {isLoading ? '…' : totalCount}
              </span>
              <button
                onClick={() => onEditStatus(status)}
                className="opacity-40 hover:opacity-80 transition-opacity text-xs leading-none"
                title="Edit status"
              >
                ⋯
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Column Content — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : displayedLeads.length === 0 ? (
          <div className="border-dashed border-2 border-muted rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">No leads in this status</p>
            <button className="mt-2 text-sm text-primary hover:underline" onClick={() => onCreateLead(status.id)}>
              Add Lead
            </button>
          </div>
        ) : (
          <>
            {displayedLeads.map((lead, leadIndex) => (
              <Draggable key={lead.id} draggableId={`lead-${lead.id}`} index={leadIndex}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`transition-all duration-200 ${snapshot.isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}`}
                  >
                    <div
                      className="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow group"
                      onClick={() => onViewLead(lead)}
                    >
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm truncate group-hover:text-primary">{lead.name}</h3>
                            {lead.title && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.title}</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0
                            ${lead.priority === 'HIGH' ? 'bg-red-100 text-red-800' : ''}
                            ${lead.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : ''}
                            ${lead.priority === 'LOW' ? 'bg-gray-100 text-gray-800' : ''}
                          `}>
                            {lead.priority}
                          </span>
                        </div>

                        {lead.company && (
                          <div className="text-xs text-muted-foreground truncate">{lead.company}</div>
                        )}

                        <div className="space-y-2">
                          <div className="text-xs">
                            <div>{lead.phone}</div>
                            {lead.email && <div className="text-muted-foreground truncate">{lead.email}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2 text-xs gap-1 flex-1"
                              onClick={(e) => { e.stopPropagation(); onCallLead?.(lead); }}
                            >
                              <Phone className="h-3 w-3" /> Call
                            </Button>
                            <Button
                              variant="outline" size="sm"
                              className="h-7 px-2 text-xs gap-1 flex-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                              onClick={(e) => { e.stopPropagation(); onWhatsAppLead?.(lead); }}
                            >
                              <MessageCircle className="h-3 w-3" /> WhatsApp
                            </Button>
                          </div>
                        </div>

                        {lead.value_amount && (
                          <div className="text-sm font-medium text-green-600">
                            ${parseFloat(lead.value_amount).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Draggable>
            ))}

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} className="py-2 flex items-center justify-center">
                {isFetchingMore && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Lead Button */}
      <div className="flex-shrink-0 mt-4">
        <button
          className="w-full border border-dashed border-muted rounded-lg p-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
          onClick={() => onCreateLead(status.id)}
        >
          + Add Lead
        </button>
      </div>
    </div>
  );
};

interface KanbanBoardProps {
  statuses: LeadStatus[];
  filterParams: Omit<LeadsQueryParams, 'page' | 'page_size' | 'status'>;
  onViewLead: (lead: Lead) => void;
  onCallLead?: (lead: Lead) => void;
  onWhatsAppLead?: (lead: Lead) => void;
  onCreateLead: (statusId?: number) => void;
  onEditStatus: (status: LeadStatus) => void;
  onDeleteStatus: (status: LeadStatus) => void;
  onCreateStatus: () => void;
  onMoveStatus: (status: LeadStatus, direction: 'up' | 'down') => void;
  onUpdateLeadStatus: (leadId: number, newStatusId: number) => Promise<void>;
  isLoading?: boolean;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  statuses,
  filterParams,
  onViewLead,
  onCallLead,
  onWhatsAppLead,
  onCreateLead,
  onEditStatus,
  onDeleteStatus,
  onCreateStatus,
  onMoveStatus,
  onUpdateLeadStatus,
  isLoading = false,
}) => {
  // Per-column lead cache (populated by each column via onLeadsLoaded)
  const [columnLeads, setColumnLeads] = useState<Record<number, Lead[]>>({});

  // Optimistic overrides: when a card is dragged, we patch locally until API resolves
  const [optimisticOverrides, setOptimisticOverrides] = useState<Record<number, Lead[]> | null>(null);

  const handleLeadsLoaded = useCallback((statusId: number, leads: Lead[]) => {
    setColumnLeads((prev) => ({ ...prev, [statusId]: leads }));
    // Clear any stale optimistic override for this column once fresh data arrives
    setOptimisticOverrides((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[statusId];
      return Object.keys(next).length === 0 ? null : next;
    });
  }, []);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const leadId = parseInt(draggableId.replace('lead-', ''));
    const fromStatusId = parseInt(source.droppableId.replace('status-', ''));
    const toStatusId = parseInt(destination.droppableId.replace('status-', ''));

    // Build optimistic state: remove from source column, insert into dest column
    const fromLeads = [...(columnLeads[fromStatusId] ?? [])];
    const toLeads = fromStatusId === toStatusId ? fromLeads : [...(columnLeads[toStatusId] ?? [])];

    const movedIdx = fromLeads.findIndex((l) => l.id === leadId);
    if (movedIdx === -1) return;
    const [movedLead] = fromLeads.splice(movedIdx, 1);

    const destLeads = fromStatusId === toStatusId ? fromLeads : toLeads;
    destLeads.splice(destination.index, 0, { ...movedLead, status: toStatusId as any });

    setOptimisticOverrides((prev) => ({
      ...(prev ?? {}),
      [fromStatusId]: fromStatusId === toStatusId ? destLeads : fromLeads,
      [toStatusId]: destLeads,
    }));

    try {
      await onUpdateLeadStatus(leadId, toStatusId);
      toast.success('Lead status updated');
    } catch (error: any) {
      setOptimisticOverrides(null); // revert
      toast.error(error?.message || 'Failed to update lead status');
    }
  }, [columnLeads, onUpdateLeadStatus]);

  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  const sortedStatuses = useMemo(() => [...statuses].sort((a, b) => a.order_index - b.order_index), [statuses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading kanban board...</p>
        </div>
      </div>
    );
  }

  if (sortedStatuses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">No Lead Statuses</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first lead status to start using the kanban board.</p>
          <Button onClick={onCreateStatus}><Plus className="h-4 w-4 mr-2" />Create Status</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Board Header */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pipeline Overview</h2>
            <p className="text-sm text-muted-foreground">{sortedStatuses.length} stages</p>
          </div>
          <Button variant="outline" onClick={onCreateStatus}>
            <Plus className="h-4 w-4 mr-2" />Add Status
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 md:gap-6 h-full overflow-x-auto pb-4 px-2 md:px-0">
            {sortedStatuses.map((status) => (
              <Droppable key={status.id} droppableId={`status-${status.id}`}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="h-full">
                    <KanbanColumnInfinite
                      status={status}
                      filterParams={filterParams}
                      onViewLead={onViewLead}
                      onCallLead={onCallLead}
                      onWhatsAppLead={onWhatsAppLead}
                      onCreateLead={onCreateLead}
                      onEditStatus={onEditStatus}
                      onDeleteStatus={onDeleteStatus}
                      onMoveStatus={onMoveStatus}
                      hexToRgba={hexToRgba}
                      overrideLeads={optimisticOverrides?.[status.id] ?? null}
                      onLeadsLoaded={handleLeadsLoaded}
                    />
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};
