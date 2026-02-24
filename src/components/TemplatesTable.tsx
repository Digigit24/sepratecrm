// src/components/TemplatesTable.tsx
import React from 'react';
import { Send, BarChart3, RefreshCcw, Hash } from 'lucide-react';
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
      <Badge variant="secondary" className={`${colorClass} text-[10px] px-1.5 py-0 h-4`}>
        {status}
      </Badge>
    );
  };

  const getCategoryBadge = (category: TemplateCategory) => {
    const colorClass = templatesService.getCategoryColor(category);
    return (
      <Badge variant="outline" className={`${colorClass} text-[10px] px-1.5 py-0 h-4`}>
        {category}
      </Badge>
    );
  };

  const getBodyText = (template: Template) => {
    if (template.components && Array.isArray(template.components)) {
      const bodyComponent = template.components.find(c => c.type === 'BODY');
      if (bodyComponent?.text) {
        const text = bodyComponent.text;
        return text.length > 60 ? `${text.substring(0, 60)}...` : text;
      }
    }
    if (template.body) {
      const text = typeof template.body === 'string' ? template.body : String(template.body);
      return text.length > 60 ? `${text.substring(0, 60)}...` : text;
    }
    if ((template as any).content) {
      const text = (template as any).content;
      return text.length > 60 ? `${text.substring(0, 60)}...` : text;
    }
    return '';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  };

  const columns: DataTableColumn<Template>[] = [
    {
      key: 'name',
      header: 'Template',
      cell: (template: Template) => {
        const preview = getBodyText(template);
        return (
          <div className="min-w-0">
            <span className="font-medium text-xs">{template.name}</span>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
              {template.language} · {template.id}
            </p>
            {preview && (
              <p className="text-[10px] text-muted-foreground/70 truncate max-w-[200px] mt-0.5">
                {preview}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (template: Template) => (
        <div className="flex flex-wrap gap-0.5">
          {getStatusBadge(template.status)}
          {getCategoryBadge(template.category)}
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Sends',
      cell: (template: Template) => (
        <span className="flex items-center gap-1 text-xs tabular-nums">
          <Hash className="h-2.5 w-2.5 text-muted-foreground" />
          {template.usage_count}
        </span>
      ),
    },
    {
      key: 'quality',
      header: 'Quality',
      cell: (template: Template) => {
        if (!template.quality_score) return <span className="text-[11px] text-muted-foreground">—</span>;

        const getQualityColor = (score: string) => {
          switch (score.toLowerCase()) {
            case 'high': return 'bg-green-100 text-green-800';
            case 'medium': return 'bg-yellow-100 text-yellow-800';
            case 'low': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
          }
        };

        return (
          <Badge variant="secondary" className={`${getQualityColor(template.quality_score)} text-[10px] px-1.5 py-0 h-4`}>
            {template.quality_score}
          </Badge>
        );
      },
    },
    {
      key: 'created',
      header: 'Created',
      cell: (template: Template) => (
        <span className="text-[11px] text-muted-foreground">
          {formatDate(template.created_at)}
        </span>
      ),
    },
  ];

  const renderMobileCard = (template: Template, actions: any) => (
    <>
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium text-sm">{template.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {template.language} · {template.id}
          </div>
        </div>
        <div className="flex gap-1">
          {getStatusBadge(template.status)}
          {getCategoryBadge(template.category)}
        </div>
      </div>

      {getBodyText(template) && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {getBodyText(template)}
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <span>{template.usage_count} sends</span>
          {template.quality_score && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
              {template.quality_score}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground">{formatDate(template.created_at)}</span>
      </div>

      <div className="flex gap-1.5 pt-1.5">
        {onSync && (
          <Button variant="outline" size="sm" onClick={() => onSync(template)} className="h-7 text-xs">
            <RefreshCcw className="h-3 w-3 mr-1" />
            Sync
          </Button>
        )}
        {template.status === TemplateStatus.APPROVED && onSend && (
          <Button variant="outline" size="sm" onClick={() => onSend(template)} className="h-7 text-xs">
            <Send className="h-3 w-3 mr-1" />
            Send
          </Button>
        )}
        {onViewAnalytics && (
          <Button variant="outline" size="sm" onClick={() => onViewAnalytics(template)} className="h-7 text-xs">
            <BarChart3 className="h-3 w-3 mr-1" />
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
