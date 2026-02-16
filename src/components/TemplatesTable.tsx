// src/components/TemplatesTable.tsx
import React from 'react';
import { Send, BarChart3, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import { Template, TemplateStatus, TemplateCategory } from '@/types/whatsappTypes';
import { templatesService } from '@/services/whatsapp/templatesService';

interface TemplatesTableProps {
  templates: Template[];
  isLoading?: boolean;
  onView?: (template: Template) => void;
  onEdit?: (template: Template) => void;
  onDelete?: (template: Template) => Promise<void>;
  onSync?: (template: Template) => void;
  onSend?: (template: Template) => void;
  onViewAnalytics?: (template: Template) => void;
}

export function TemplatesTable({
  templates,
  isLoading = false,
  onView,
  onEdit,
  onDelete,
  onSync,
  onSend,
  onViewAnalytics
}: TemplatesTableProps) {

  const getStatusBadge = (status: TemplateStatus) => {
    const colorClass = templatesService.getStatusColor(status);
    return (
      <Badge variant="secondary" className={colorClass}>
        {status}
      </Badge>
    );
  };

  const getCategoryBadge = (category: TemplateCategory) => {
    const colorClass = templatesService.getCategoryColor(category);
    return (
      <Badge variant="outline" className={colorClass}>
        {category}
      </Badge>
    );
  };

  const getBodyText = (template: Template) => {
    // Handle components array format (Meta/WhatsApp standard)
    if (template.components && Array.isArray(template.components)) {
      const bodyComponent = template.components.find(c => c.type === 'BODY');
      if (bodyComponent?.text) {
        const text = bodyComponent.text;
        return text.length > 100 ? `${text.substring(0, 100)}...` : text;
      }
    }

    // Handle Laravel API format - body might be a direct field
    if (template.body) {
      const text = typeof template.body === 'string' ? template.body : String(template.body);
      return text.length > 100 ? `${text.substring(0, 100)}...` : text;
    }

    // Handle content field
    if ((template as any).content) {
      const text = (template as any).content;
      return text.length > 100 ? `${text.substring(0, 100)}...` : text;
    }

    return '-';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const columns: DataTableColumn<Template>[] = [
    {
      key: 'name',
      header: 'Template Name',
      cell: (template: Template) => (
        <div className="space-y-1">
          <div className="font-medium">{template.name}</div>
          <div className="text-sm text-muted-foreground">
            {template.language} • ID: {template.id}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (template: Template) => getStatusBadge(template.status),
    },
    {
      key: 'category',
      header: 'Category',
      cell: (template: Template) => getCategoryBadge(template.category),
    },
    {
      key: 'content',
      header: 'Content Preview',
      cell: (template: Template) => (
        <div className="max-w-xs">
          <div className="text-sm text-muted-foreground truncate">
            {getBodyText(template)}
          </div>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      cell: (template: Template) => (
        <div className="text-center">
          <div className="font-medium">{template.usage_count}</div>
          <div className="text-xs text-muted-foreground">sends</div>
        </div>
      ),
    },
    {
      key: 'quality',
      header: 'Quality',
      cell: (template: Template) => {
        if (!template.quality_score) return '-';
        
        const getQualityColor = (score: string) => {
          switch (score.toLowerCase()) {
            case 'high': return 'bg-green-100 text-green-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
          }
        };
        
        return (
          <Badge variant="secondary" className={getQualityColor(template.quality_score)}>
            {template.quality_score}
          </Badge>
        );
      },
    },
    {
      key: 'created',
      header: 'Created',
      cell: (template: Template) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(template.created_at)}
        </div>
      ),
    },
  ];

  const renderMobileCard = (template: Template, actions: any) => (
    <>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="font-medium">{template.name}</div>
          <div className="text-sm text-muted-foreground">
            {template.language} • ID: {template.id}
          </div>
        </div>
        <div className="flex gap-2">
          {getStatusBadge(template.status)}
          {getCategoryBadge(template.category)}
        </div>
      </div>
      
      <div className="text-sm text-muted-foreground">
        {getBodyText(template)}
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span>{template.usage_count} sends</span>
          {template.quality_score && (
            <Badge variant="secondary" className="text-xs">
              {template.quality_score}
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground">
          {formatDate(template.created_at)}
        </span>
      </div>
      
      <div className="flex gap-2 pt-2">
        {onSync && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSync(template)}
            title="Sync template status with Meta API"
          >
            <RefreshCcw className="h-4 w-4 mr-1" />
            Sync
          </Button>
        )}
        {template.status === TemplateStatus.APPROVED && onSend && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSend(template)}
          >
            <Send className="h-4 w-4 mr-1" />
            Send
          </Button>
        )}
        {onViewAnalytics && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewAnalytics(template)}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Analytics
          </Button>
        )}
      </div>
    </>
  );

  const getExtraActions = (template: Template) => (
    <>
      {onSync && (
        <DropdownMenuItem onClick={() => onSync(template)}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Sync Status
        </DropdownMenuItem>
      )}

      {template.status === TemplateStatus.APPROVED && onSend && (
        <DropdownMenuItem onClick={() => onSend(template)}>
          <Send className="mr-2 h-4 w-4" />
          Send Message
        </DropdownMenuItem>
      )}

      {onViewAnalytics && (
        <DropdownMenuItem onClick={() => onViewAnalytics(template)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          View Analytics
        </DropdownMenuItem>
      )}
    </>
  );

  return (
    <DataTable
      rows={templates}
      isLoading={isLoading}
      columns={columns}
      renderMobileCard={renderMobileCard}
      getRowId={(template) => template.id}
      getRowLabel={(template) => template.name}
      onRowClick={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      extraActions={getExtraActions}
      emptyTitle="No templates found"
      emptySubtitle="Create your first WhatsApp template to get started"
    />
  );
}