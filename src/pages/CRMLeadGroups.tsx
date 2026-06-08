// src/pages/CRMLeadGroups.tsx
import { useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, RefreshCw, Users, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { LeadGroup, CreateLeadGroupPayload, UpdateLeadGroupPayload, LeadGroupsQueryParams } from '@/types/crmTypes';
import type { RowActions } from '@/components/DataTable';

const COLOR_PRESETS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#14B8A6',
  '#3B82F6', '#64748B',
];

interface GroupFormState {
  name: string;
  description: string;
  color_hex: string;
}

const defaultForm = (): GroupFormState => ({ name: '', description: '', color_hex: '#6366F1' });

export const CRMLeadGroups: React.FC = () => {
  const { hasModuleAccess } = useAuth();
  const { hasCRMAccess, useLeadGroups, createLeadGroup, updateLeadGroup, deleteLeadGroup } = useCRM();

  const [queryParams, setQueryParams] = useState<LeadGroupsQueryParams>({
    page: 1,
    page_size: 50,
    ordering: 'name',
  });

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LeadGroup | null>(null);
  const [form, setForm] = useState<GroupFormState>(defaultForm());
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<LeadGroup | null>(null);

  const { data, error, isLoading, mutate } = useLeadGroups(queryParams);

  if (!hasCRMAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">CRM Access Required</h2>
            <p className="text-muted-foreground">CRM module is not enabled for your account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handlers
  const openCreate = useCallback(() => {
    setEditingGroup(null);
    setForm(defaultForm());
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((group: LeadGroup) => {
    setEditingGroup(group);
    setForm({ name: group.name, description: group.description || '', color_hex: group.color_hex || '#6366F1' });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error('Group name is required');
      return;
    }
    setIsSaving(true);
    try {
      if (editingGroup) {
        const payload: UpdateLeadGroupPayload = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          color_hex: form.color_hex || undefined,
        };
        await updateLeadGroup(editingGroup.id, payload);
        toast.success('Group updated');
      } else {
        const payload: CreateLeadGroupPayload = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          color_hex: form.color_hex || undefined,
        };
        await createLeadGroup(payload);
        toast.success('Group created');
      }
      mutate();
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save group');
    } finally {
      setIsSaving(false);
    }
  }, [form, editingGroup, createLeadGroup, updateLeadGroup, mutate]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteLeadGroup(deleteTarget.id);
      toast.success(`Deleted group "${deleteTarget.name}"`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group');
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, deleteLeadGroup, mutate]);

  const columns: DataTableColumn<LeadGroup>[] = [
    {
      key: 'name',
      header: 'Group Name',
      sortable: true,
      render: (group) => (
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: group.color_hex || '#6366F1' }}
          />
          <span className="font-medium">{group.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (group) => (
        <span className="text-muted-foreground text-sm">{group.description || '—'}</span>
      ),
    },
    {
      key: 'lead_count',
      header: 'Leads',
      sortable: false,
      render: (group) => (
        <Badge variant="secondary" className="gap-1">
          <Users className="w-3 h-3" />
          {group.lead_count ?? 0}
        </Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (group) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(group.created_at), { addSuffix: true })}
        </span>
      ),
    },
  ];

  const rowActions: RowActions<LeadGroup> = {
    items: [
      {
        label: 'Edit',
        icon: <Pencil className="w-4 h-4" />,
        onClick: openEdit,
      },
      {
        label: 'Delete',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: (group) => setDeleteTarget(group),
        variant: 'destructive',
      },
    ],
  };

  const groups = data?.results || [];
  const totalCount = data?.count || 0;

  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Layers className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Lead Groups</h1>
            <p className="text-sm text-muted-foreground">
              Organise your leads into named lists or collections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />
            New Group
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>{totalCount} group{totalCount !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <DataTable
            data={groups}
            columns={columns}
            rowActions={rowActions}
            isLoading={isLoading}
            emptyMessage="No groups yet. Create your first group to start organising leads."
            onRowClick={openEdit}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > (queryParams.page_size || 50) && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.previous}
            onClick={() => setQueryParams(p => ({ ...p, page: (p.page || 1) - 1 }))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground self-center">
            Page {queryParams.page} of {Math.ceil(totalCount / (queryParams.page_size || 50))}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!data?.next}
            onClick={() => setQueryParams(p => ({ ...p, page: (p.page || 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Group' : 'New Lead Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Name <span className="text-destructive">*</span></Label>
              <Input
                id="group-name"
                placeholder="e.g. VIP Clients, Cold Leads…"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-desc">Description</Label>
              <Textarea
                id="group-desc"
                placeholder="Optional description…"
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${form.color_hex === color ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setForm(f => ({ ...f, color_hex: color }))}
                  />
                ))}
                <input
                  type="color"
                  value={form.color_hex}
                  onChange={e => setForm(f => ({ ...f, color_hex: e.target.value }))}
                  className="w-7 h-7 rounded cursor-pointer border border-border"
                  title="Custom color"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? Leads in this group will not be deleted — they just won't be in the group anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
