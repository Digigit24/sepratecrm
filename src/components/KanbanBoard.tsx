// src/components/KanbanBoard.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Plus, Settings, Phone, MessageCircle } from 'lucide-react';
import { KanbanColumn } from './KanbanColumn';
import { toast } from 'sonner';
import type { Lead, LeadStatus } from '@/types/crmTypes';

interface KanbanBoardProps {
  leads: Lead[];
  statuses: LeadStatus[];
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
  leads,
  statuses,
  onViewLead,
  onCallLead,
  onWhatsAppLead,
  onCreateLead,
  onEditStatus,
  onDeleteStatus,
  onCreateStatus,
  onMoveStatus,
  onUpdateLeadStatus,
  isLoading = false
}) => {
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);

  // Group leads by status
  const leadsByStatus = useMemo(() => {
    const grouped: Record<number, Lead[]> = {};
    
    // Initialize all statuses with empty arrays
    statuses.forEach(status => {
      grouped[status.id] = [];
    });
    
    // Group leads by their status
    leads.forEach(lead => {
      // Handle both object and number status formats
      const statusId = typeof lead.status === 'object' ? lead.status?.id : lead.status;
      if (statusId) {
        if (!grouped[statusId]) {
          grouped[statusId] = [];
        }
        grouped[statusId].push(lead);
      }
    });
    
    return grouped;
  }, [leads, statuses]);

  // Handle drag end - optimistic updates are now handled in parent component
  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // If dropped outside a droppable area
    if (!destination) {
      setDraggedLead(null);
      return;
    }
    
    // If dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      setDraggedLead(null);
      return;
    }

    const leadId = parseInt(draggableId.replace('lead-', ''));
    const newStatusId = parseInt(destination.droppableId.replace('status-', ''));
    
    setDraggedLead(null);

    try {
      // The optimistic update is handled in the parent component via SWR mutate
      await onUpdateLeadStatus(leadId, newStatusId);
      toast.success('Lead status updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update lead status');
    }
  }, [onUpdateLeadStatus]);

  // Handle drag start
  const handleDragStart = useCallback((start: any) => {
    const leadId = parseInt(start.draggableId.replace('lead-', ''));
    const lead = leads.find(l => l.id === leadId);
    setDraggedLead(lead || null);
  }, [leads]);

  // Helper function to convert hex to rgba
  const hexToRgba = useCallback((hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Sort statuses by order_index
  const sortedStatuses = useMemo(() => {
    return [...statuses].sort((a, b) => a.order_index - b.order_index);
  }, [statuses]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
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
          <p className="text-sm text-muted-foreground mb-4">
            Create your first lead status to start using the kanban board.
          </p>
          <Button onClick={onCreateStatus}>
            <Plus className="h-4 w-4 mr-2" />
            Create Status
          </Button>
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
            <p className="text-sm text-muted-foreground">
              {leads.length} leads across {sortedStatuses.length} stages
            </p>
          </div>
          <Button variant="outline" onClick={onCreateStatus}>
            <Plus className="h-4 w-4 mr-2" />
            Add Status
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
          <div className="flex gap-4 md:gap-6 h-full overflow-x-auto pb-4 px-2 md:px-0">
            {sortedStatuses.map((status, index) => {
              const statusLeads = leadsByStatus[status.id] || [];
              
              return (
                <Droppable key={status.id} droppableId={`status-${status.id}`}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="h-full"
                    >
                      <div className="flex flex-col h-full min-w-[280px] max-w-[280px] md:min-w-[320px] md:max-w-[320px]">
                        {/* Column Header */}
                        <div className="flex-shrink-0 mb-4">
                          <div
                            className="rounded-lg px-3 py-2 border"
                            style={{
                              backgroundColor: hexToRgba(status.color_hex || '#6B7280', 0.15),
                              borderColor: status.color_hex || '#6B7280'
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: status.color_hex || '#6B7280' }}
                                />
                                <h3
                                  className="font-semibold text-sm"
                                  style={{ color: status.color_hex || '#6B7280' }}
                                >
                                  {status.name}
                                </h3>
                                {status.is_won && (
                                  <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded">
                                    Won
                                  </span>
                                )}
                                {status.is_lost && (
                                  <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded">
                                    Lost
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-xs font-medium"
                                style={{ color: status.color_hex || '#6B7280' }}
                              >
                                {statusLeads.length}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Column Content */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                          {statusLeads.length === 0 ? (
                            <div className="border-dashed border-2 border-muted rounded-lg p-6 text-center">
                              <p className="text-sm text-muted-foreground">No leads in this status</p>
                              <button
                                className="mt-2 text-sm text-primary hover:underline"
                                onClick={() => onCreateLead(status.id)}
                              >
                                Add Lead
                              </button>
                            </div>
                          ) : (
                            statusLeads.map((lead, leadIndex) => (
                              <Draggable
                                key={lead.id}
                                draggableId={`lead-${lead.id}`}
                                index={leadIndex}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`
                                      transition-all duration-200
                                      ${snapshot.isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}
                                    `}
                                  >
                                    <div
                                      className="bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow group"
                                      onClick={() => onViewLead(lead)}
                                    >
                                      <div className="space-y-3">
                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-sm truncate group-hover:text-primary">
                                              {lead.name}
                                            </h3>
                                            {lead.title && (
                                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                                {lead.title}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <span className={`
                                              text-xs px-2 py-1 rounded-full
                                              ${lead.priority === 'HIGH' ? 'bg-red-100 text-red-800' : ''}
                                              ${lead.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' : ''}
                                              ${lead.priority === 'LOW' ? 'bg-gray-100 text-gray-800' : ''}
                                            `}>
                                              {lead.priority}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Company */}
                                        {lead.company && (
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="truncate">{lead.company}</span>
                                          </div>
                                        )}

                                        {/* Contact */}
                                        <div className="space-y-2">
                                          <div className="text-xs">
                                            <div>{lead.phone}</div>
                                            {lead.email && (
                                              <div className="text-muted-foreground truncate">{lead.email}</div>
                                            )}
                                          </div>
                                          {/* Call and WhatsApp Buttons */}
                                          <div className="flex items-center gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 px-2 text-xs gap-1 flex-1"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onCallLead?.(lead);
                                              }}
                                            >
                                              <Phone className="h-3 w-3" />
                                              Call
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 px-2 text-xs gap-1 flex-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onWhatsAppLead?.(lead);
                                              }}
                                            >
                                              <MessageCircle className="h-3 w-3" />
                                              WhatsApp
                                            </Button>
                                          </div>
                                        </div>

                                        {/* Value */}
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
                            ))
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
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};