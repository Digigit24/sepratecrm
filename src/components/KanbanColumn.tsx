// src/components/KanbanColumn.tsx
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  ArrowUp, 
  ArrowDown,
  Settings
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KanbanCard } from './KanbanCard';
import type { Lead, LeadStatus } from '@/types/crmTypes';

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  onViewLead: (lead: Lead) => void;
  onCallLead?: (lead: Lead) => void;
  onWhatsAppLead?: (lead: Lead) => void;
  onCreateLead: (statusId: number) => void;
  onEditStatus: (status: LeadStatus) => void;
  onDeleteStatus: (status: LeadStatus) => void;
  onMoveStatus: (status: LeadStatus, direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDropTarget?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  dragHandleProps?: any;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  leads,
  onViewLead,
  onCallLead,
  onWhatsAppLead,
  onCreateLead,
  onEditStatus,
  onDeleteStatus,
  onMoveStatus,
  canMoveUp,
  canMoveDown,
  isDropTarget = false,
  onDragOver,
  onDragLeave,
  onDrop,
  dragHandleProps
}) => {
  // Get status color
  const statusColor = status.color_hex || '#6B7280';
  
  // Calculate total value for this column
  const totalValue = leads.reduce((sum, lead) => {
    if (lead.value_amount) {
      return sum + parseFloat(lead.value_amount);
    }
    return sum;
  }, 0);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <div 
      className={`
        flex flex-col h-full min-w-[320px] max-w-[320px]
        ${isDropTarget ? 'ring-2 ring-primary ring-offset-2' : ''}
      `}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <Card className="flex-shrink-0 mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full border border-gray-300"
                style={{ backgroundColor: statusColor }}
              />
              <div>
                <h3 className="font-semibold text-sm">{status.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {leads.length} leads
                  </Badge>
                  {totalValue > 0 && (
                    <Badge variant="outline" className="text-xs text-green-600">
                      {formatCurrency(totalValue)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Status Properties */}
              <div className="flex gap-1">
                {status.is_won && (
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800 border-green-200">
                    Won
                  </Badge>
                )}
                {status.is_lost && (
                  <Badge variant="destructive" className="text-xs bg-red-100 text-red-800 border-red-200">
                    Lost
                  </Badge>
                )}
              </div>

              {/* Column Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onCreateLead(status.id)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEditStatus(status)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Status
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onMoveStatus(status, 'up')}
                    disabled={!canMoveUp}
                  >
                    <ArrowUp className="h-4 w-4 mr-2" />
                    Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onMoveStatus(status, 'down')}
                    disabled={!canMoveDown}
                  >
                    <ArrowDown className="h-4 w-4 mr-2" />
                    Move Down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => onDeleteStatus(status)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Status
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Column Content - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {leads.length === 0 ? (
          <Card className="border-dashed border-2 border-muted">
            <CardContent className="p-6 text-center">
              <div className="text-muted-foreground">
                <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No leads in this status</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  onClick={() => onCreateLead(status.id)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Lead
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onView={onViewLead}
              onCall={onCallLead}
              onWhatsApp={onWhatsAppLead}
              dragHandleProps={dragHandleProps}
            />
          ))
        )}
      </div>

      {/* Add Lead Button */}
      <div className="flex-shrink-0 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onCreateLead(status.id)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Lead
        </Button>
      </div>
    </div>
  );
};