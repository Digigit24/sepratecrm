// src/pages/CRMSequences.tsx
// WhatsApp follow-up sequences — Django-owned, Laravel fires the messages
import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  Plus, RefreshCw, Zap, Loader2, ChevronRight,
  Search, ToggleLeft, ToggleRight, Trash2, Pencil, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SideDrawer } from '@/components/SideDrawer';
import { whatsAppCrmService, type WhatsAppSequence, type WhatsAppSequenceStep } from '@/services/whatsappCrmService';

// ---- Step editor sub-component ----
interface StepEditorProps {
  steps: WhatsAppSequenceStep[];
  templates: { uid: string; name: string }[];
  onAddStep: (data: Partial<WhatsAppSequenceStep>) => Promise<void>;
  onDeleteStep: (stepId: number) => Promise<void>;
}

function StepEditor({ steps, templates, onAddStep, onDeleteStep }: StepEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newStep, setNewStep] = useState({ template_uid: '', delay_days: 0 });

  const handleAdd = async () => {
    if (!newStep.template_uid) { toast.error('Select a template'); return; }
    await onAddStep({ template_uid: newStep.template_uid, delay_days: newStep.delay_days, step_number: steps.length + 1 });
    setAdding(false);
    setNewStep({ template_uid: '', delay_days: 0 });
  };

  return (
    <div className="space-y-2 mt-3">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <span className="font-medium">Step {step.step_number}</span>
            <span className="text-muted-foreground ml-2">
              {step.delay_days === 0 ? 'Immediately' : `After ${step.delay_days} day${step.delay_days !== 1 ? 's' : ''}`}
            </span>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {step.template_name || step.template_uid}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDeleteStep(step.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      {adding ? (
        <div className="p-3 rounded-lg border border-dashed border-border space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Template</Label>
              <Select value={newStep.template_uid} onValueChange={(v) => setNewStep(s => ({ ...s, template_uid: v }))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.uid} value={t.uid}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Delay (days)</Label>
              <Input
                type="number"
                min={0}
                className="h-8 text-xs"
                value={newStep.delay_days}
                onChange={(e) => setNewStep(s => ({ ...s, delay_days: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>Add Step</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-8 text-xs border-dashed" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Step
        </Button>
      )}
    </div>
  );
}

// ---- Main page ----
export const CRMSequences: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Sequence CRUD drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', is_active: true, stop_on_reply: true });

  // Step-detail panel (expand sequence inline)
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const swrKey = ['/whatsapp/sequences', page, search];
  const { data, isLoading, mutate } = useSWR(
    swrKey,
    () => whatsAppCrmService.getSequences({ page, search: search || undefined }),
    { revalidateOnFocus: false }
  );

  // Load detail (with steps) for expanded sequence
  const { data: detailData, mutate: mutateDetail } = useSWR(
    expandedId ? `/whatsapp/sequences/${expandedId}` : null,
    () => whatsAppCrmService.getSequence(expandedId!),
    { revalidateOnFocus: false }
  );

  // Templates for step editor
  const { data: templates } = useSWR(
    expandedId ? '/whatsapp/templates' : null,
    () => whatsAppCrmService.getTemplates(),
    { revalidateOnFocus: false }
  );

  const sequences = data?.results ?? [];

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: '', description: '', is_active: true, stop_on_reply: true });
    setDrawerOpen(true);
  };

  const openEdit = (seq: WhatsAppSequence) => {
    setEditingId(seq.id);
    setForm({ name: seq.name, description: seq.description || '', is_active: seq.is_active, stop_on_reply: seq.stop_on_reply });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setIsSaving(true);
    try {
      if (editingId) {
        await whatsAppCrmService.updateSequence(editingId, form);
        toast.success('Sequence updated');
      } else {
        await whatsAppCrmService.createSequence(form);
        toast.success('Sequence created');
      }
      setDrawerOpen(false);
      mutate();
    } catch {
      toast.error('Failed to save sequence');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddStep = useCallback(async (data: Partial<WhatsAppSequenceStep>) => {
    if (!expandedId) return;
    try {
      await whatsAppCrmService.addSequenceStep(expandedId, data);
      mutateDetail();
      toast.success('Step added');
    } catch {
      toast.error('Failed to add step');
    }
  }, [expandedId, mutateDetail]);

  const handleDeleteStep = useCallback(async (stepId: number) => {
    if (!expandedId) return;
    if (!confirm('Delete this step?')) return;
    try {
      await whatsAppCrmService.deleteSequenceStep(expandedId, stepId);
      mutateDetail();
      toast.success('Step deleted');
    } catch {
      toast.error('Failed to delete step');
    }
  }, [expandedId, mutateDetail]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Follow-up Sequences</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{data?.count ?? 0} sequence{data?.count !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Sequence
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search sequences..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="pl-8 h-9"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Zap className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No sequences yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create automated follow-up sequences for your leads</p>
          <Button size="sm" className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> New Sequence
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.map((seq) => {
            const isExpanded = expandedId === seq.id;
            return (
              <Card key={seq.id} className="border-border/60">
                <CardContent className="p-0">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
                    onClick={() => setExpandedId(isExpanded ? null : seq.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{seq.name}</span>
                        <Badge variant={seq.is_active ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {seq.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {seq.stop_on_reply && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Stops on reply</Badge>
                        )}
                      </div>
                      {seq.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{seq.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); openEdit(seq); }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border/40 pt-3">
                      {detailData?.id === seq.id ? (
                        <StepEditor
                          steps={detailData.steps ?? []}
                          templates={(templates ?? []).map((t: any) => ({ uid: t.uid, name: t.name }))}
                          onAddStep={handleAddStep}
                          onDeleteStep={handleDeleteStep}
                        />
                      ) : (
                        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading steps...
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(data?.count ?? 0) > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">Page {page}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= (data?.count ?? 0)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create / Edit drawer */}
      <SideDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editingId ? 'Edit Sequence' : 'New Sequence'}
        footerButtons={[
          {
            label: isSaving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Sequence',
            onClick: handleSave,
            disabled: isSaving,
            variant: 'default',
          },
        ]}
      >
        <div className="space-y-4 p-4">
          <div className="space-y-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. New Lead Follow-up"
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="What this sequence does..."
              rows={2}
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Stop on Reply</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Pause sequence when lead replies</p>
            </div>
            <Switch
              checked={form.stop_on_reply}
              onCheckedChange={(v) => setForm(f => ({ ...f, stop_on_reply: v }))}
            />
          </div>
        </div>
      </SideDrawer>
    </div>
  );
};
