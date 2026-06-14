// src/components/crm/CampaignFormDrawer.tsx
// Drawer for creating a new WhatsApp campaign from DigiCRM
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { SideDrawer } from '@/components/SideDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { whatsAppCrmService, type WhatsAppTemplate } from '@/services/whatsappCrmService';
import { crmClient } from '@/lib/client';
import { buildQueryString } from '@/lib/apiConfig';

interface CampaignFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface LeadGroup {
  id: number;
  name: string;
  lead_count?: number;
}

export function CampaignFormDrawer({ open, onOpenChange, onSuccess }: CampaignFormDrawerProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    lead_group: '__none__',
    template_uid: '',
    notes: '',
    scheduled_at: '',
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      setForm({ name: '', lead_group: '__none__', template_uid: '', notes: '', scheduled_at: '' });
    }
  }, [open]);

  // Load templates
  const { data: templates, isLoading: templatesLoading } = useSWR(
    open ? '/whatsapp/templates' : null,
    () => whatsAppCrmService.getTemplates(),
    { revalidateOnFocus: false }
  );

  // Load lead groups
  const { data: groupsData, isLoading: groupsLoading } = useSWR(
    open ? '/crm/lead-groups' : null,
    async () => {
      const res = await crmClient.get<{ results: LeadGroup[] }>(`/crm/lead-groups/${buildQueryString({ page_size: 200 })}`);
      return res.data.results;
    },
    { revalidateOnFocus: false }
  );

  const selectedTemplate = templates?.find((t: WhatsAppTemplate) => t.uid === form.template_uid);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Campaign name is required'); return; }
    if (!form.template_uid) { toast.error('Please select a template'); return; }

    setIsSaving(true);
    try {
      await whatsAppCrmService.createCampaign({
        name: form.name.trim(),
        lead_group: (form.lead_group && form.lead_group !== '__none__') ? parseInt(form.lead_group) : null,
        template_uid: form.template_uid,
        template_name: selectedTemplate?.name,
        template_components: selectedTemplate?.components ?? [],
        notes: form.notes.trim() || undefined,
        scheduled_at: form.scheduled_at || null,
      });
      toast.success('Campaign created');
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to create campaign');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="New Campaign"
      description="Create a WhatsApp campaign from DigiCRM"
      footerButtons={[
        {
          label: isSaving ? 'Creating...' : 'Create Campaign',
          onClick: handleSubmit,
          disabled: isSaving,
          variant: 'default',
        },
      ]}
    >
      <div className="space-y-4 p-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="camp-name">Campaign Name <span className="text-destructive">*</span></Label>
          <Input
            id="camp-name"
            placeholder="e.g. May Promo — Real Estate"
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>

        {/* Template */}
        <div className="space-y-1.5">
          <Label>Template <span className="text-destructive">*</span></Label>
          {templatesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading templates...
            </div>
          ) : (
            <Select value={form.template_uid} onValueChange={(v) => setForm(f => ({ ...f, template_uid: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {(templates ?? []).map((t: WhatsAppTemplate) => (
                  <SelectItem key={t.uid} value={t.uid}>
                    <div>
                      <span className="font-medium">{t.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{t.language} · {t.category}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Template preview */}
        {selectedTemplate && (
          <div className="bg-muted/40 rounded-lg p-3 text-sm space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Template Preview</p>
            {selectedTemplate.components.map((comp, i) => (
              <div key={i}>
                {comp.type === 'HEADER' && comp.text && (
                  <p className="font-semibold">{comp.text}</p>
                )}
                {comp.type === 'BODY' && comp.text && (
                  <p className="text-muted-foreground text-xs whitespace-pre-wrap line-clamp-4">{comp.text}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lead Group */}
        <div className="space-y-1.5">
          <Label>Lead Group (optional)</Label>
          {groupsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading groups...
            </div>
          ) : (
            <Select value={form.lead_group} onValueChange={(v) => setForm(f => ({ ...f, lead_group: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="All leads or select a group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No group (manual launch)</SelectItem>
                {(groupsData ?? []).map((g: LeadGroup) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name} {g.lead_count != null ? `(${g.lead_count})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Scheduled at */}
        <div className="space-y-1.5">
          <Label htmlFor="sched-at">Schedule At (optional)</Label>
          <Input
            id="sched-at"
            type="datetime-local"
            value={form.scheduled_at}
            onChange={(e) => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">Leave blank to save as draft and launch manually.</p>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="camp-notes">Notes (optional)</Label>
          <Textarea
            id="camp-notes"
            placeholder="Internal notes about this campaign..."
            rows={3}
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>
    </SideDrawer>
  );
}
