// src/components/KanbanCard.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Phone,
  Mail,
  IndianRupee,
  Calendar,
  GripVertical,
  Eye,
  MessageCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, parseISO, isPast, isToday, isTomorrow, format } from 'date-fns';
import type { Lead, PriorityEnum } from '@/types/crmTypes';
import { useCurrency } from '@/hooks/useCurrency';

interface KanbanCardProps {
  lead: Lead;
  onView: (lead: Lead) => void;
  onCall?: (lead: Lead) => void;
  onWhatsApp?: (lead: Lead) => void;
  isDragging?: boolean;
  dragHandleProps?: any;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  lead,
  onView,
  onCall,
  onWhatsApp,
  isDragging = false,
  dragHandleProps
}) => {
  const { formatCurrency: formatCurrencyDynamic } = useCurrency();

  // Priority badge helper
  const getPriorityBadge = (priority: PriorityEnum) => {
    const variants = {
      LOW: 'bg-gray-100 text-gray-800 border-gray-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      HIGH: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <Badge variant="outline" className={`text-xs ${variants[priority]}`}>
        {priority}
      </Badge>
    );
  };

  // Format currency using tenant settings
  const formatCurrency = (amount?: string, currencyCode?: string) => {
    if (!amount) return null;
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return null;

    // Use dynamic currency formatting from tenant settings (no decimals for Kanban)
    return formatCurrencyDynamic(numericAmount, true, 0);
  };

  // Get follow-up badge with status indicator
  const getFollowupBadge = (followUpDate: string) => {
    const date = parseISO(followUpDate);
    const isOverdue = isPast(date) && !isToday(date);

    if (isOverdue) {
      return (
        <Badge variant="destructive" className="text-xs gap-1 animate-pulse">
          <AlertCircle className="h-3 w-3" />
          Overdue - {format(date, 'MMM dd')}
        </Badge>
      );
    }

    if (isToday(date)) {
      return (
        <Badge className="text-xs gap-1 bg-orange-500 hover:bg-orange-600">
          <Clock className="h-3 w-3" />
          Today - {format(date, 'hh:mm a')}
        </Badge>
      );
    }

    if (isTomorrow(date)) {
      return (
        <Badge variant="secondary" className="text-xs gap-1 bg-blue-500 text-white hover:bg-blue-600">
          <Calendar className="h-3 w-3" />
          Tomorrow - {format(date, 'hh:mm a')}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-xs gap-1">
        <Calendar className="h-3 w-3" />
        {formatDistanceToNow(date, { addSuffix: true })}
      </Badge>
    );
  };

  return (
    <Card 
      className={`
        cursor-pointer transition-all duration-200 hover:shadow-md
        ${isDragging ? 'opacity-50 rotate-2 shadow-lg' : ''}
        group
      `}
      onClick={() => onView(lead)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header with drag handle */}
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
            {getPriorityBadge(lead.priority)}
            <div 
              {...dragHandleProps}
              className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
            >
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Company */}
        {lead.company && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.company}</span>
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{lead.phone}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {/* Call and WhatsApp Buttons */}
          {(onCall || onWhatsApp) && (
            <div className="flex items-center gap-2 pt-1">
              {onCall && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCall(lead);
                  }}
                >
                  <Phone className="h-3 w-3" />
                  Call
                </Button>
              )}
              {onWhatsApp && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 flex-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    onWhatsApp(lead);
                  }}
                >
                  <MessageCircle className="h-3 w-3" />
                  WhatsApp
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Value */}
        {lead.value_amount && (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600">
            <IndianRupee className="h-3 w-3 flex-shrink-0" />
            <span>{formatCurrency(lead.value_amount, lead.value_currency)}</span>
          </div>
        )}

        {/* Next Follow-up */}
        {lead.next_follow_up_at && (
          <div className="flex items-start gap-2">
            {getFollowupBadge(lead.next_follow_up_at)}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-muted/50">
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              onView(lead);
            }}
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};