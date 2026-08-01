// src/pages/real-estate/ProjectDetailPage.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Edit, Home, ImageIcon, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { SideDrawer, type DrawerActionButton } from '@/components/SideDrawer';
import { useRealEstate } from '@/hooks/useRealEstate';
import {
  BlockType,
  UnitFacing,
  UnitStatus,
  UnitType,
  type Block,
  type BlockCreateData,
  type Project,
  type Unit,
  type UnitCreateData,
  type UnitsQueryParams,
} from '@/types/realEstate.types';

const BLOCK_TYPES = Object.values(BlockType);
const UNIT_TYPES = Object.values(UnitType);
const UNIT_STATUSES = Object.values(UnitStatus);
const UNIT_FACINGS = Object.values(UnitFacing);

const labelize = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const money = (value?: string | number | null) => {
  if (value === null || value === undefined || value === '') return '-';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const statusTone: Partial<Record<UnitStatus, string>> = {
  [UnitStatus.AVAILABLE]: 'bg-green-100 text-green-700 hover:bg-green-100',
  [UnitStatus.HELD]: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  [UnitStatus.BOOKED]: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  [UnitStatus.SOLD]: 'bg-muted text-muted-foreground hover:bg-muted',
  [UnitStatus.BLOCKED]: 'bg-red-100 text-red-700 hover:bg-red-100',
};

const relatedId = (value: number | { id: number } | null | undefined) =>
  typeof value === 'number' ? value : value?.id;

const relatedName = (value: number | { name?: string; unit_number?: string } | null | undefined, fallback: string) => {
  if (typeof value === 'number') return `${fallback} #${value}`;
  return value?.name || value?.unit_number || '-';
};

const emptyBlockForm = (projectId: number): BlockCreateData => ({
  project: projectId,
  name: '',
  block_type: BlockType.TOWER,
  total_floors: 1,
});

const blockToForm = (block: Block, projectId: number): BlockCreateData => ({
  project: relatedId(block.project) || projectId,
  name: block.name,
  block_type: block.block_type,
  total_floors: block.total_floors,
});

const emptyUnitForm = (projectId: number): UnitCreateData => ({
  project: projectId,
  block: null,
  unit_type: UnitType.FLAT,
  unit_number: '',
  floor_number: null,
  facing: null,
  configuration: '',
  carpet_area_sqft: null,
  built_up_area_sqft: null,
  super_built_up_area_sqft: null,
  plot_dimensions: '',
  rate_per_sqft: null,
  base_price: null,
  total_price: null,
  status: UnitStatus.AVAILABLE,
  amenities: null,
  metadata: null,
});

const unitToForm = (unit: Unit, projectId: number): UnitCreateData => ({
  project: relatedId(unit.project) || projectId,
  block: relatedId(unit.block) || null,
  unit_type: unit.unit_type,
  unit_number: unit.unit_number,
  floor_number: unit.floor_number,
  facing: unit.facing,
  configuration: unit.configuration || '',
  carpet_area_sqft: unit.carpet_area_sqft,
  built_up_area_sqft: unit.built_up_area_sqft,
  super_built_up_area_sqft: unit.super_built_up_area_sqft,
  plot_dimensions: unit.plot_dimensions || '',
  rate_per_sqft: unit.rate_per_sqft,
  base_price: unit.base_price,
  total_price: unit.total_price,
  status: unit.status,
  amenities: unit.amenities,
  metadata: unit.metadata,
});

const numberOrNull = (value: string): number | null => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const ProjectDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const validProjectId = Number.isFinite(projectId) ? projectId : null;

  const {
    useProject,
    useProjectSummary,
    useBlocks,
    useUnits,
    createBlock,
    updateBlock,
    deleteBlock,
    createUnit,
    updateUnit,
    deleteUnit,
  } = useRealEstate();

  const { data: project, error: projectError, isLoading: projectLoading, mutate: mutateProject } = useProject(validProjectId);
  const { data: summary, mutate: mutateSummary } = useProjectSummary(validProjectId);
  const { data: blocksData, mutate: mutateBlocks } = useBlocks(validProjectId);

  const [statusFilter, setStatusFilter] = useState<'all' | UnitStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | UnitType>('all');
  const [blockFilter, setBlockFilter] = useState<'all' | string>('all');
  const [floorFilter, setFloorFilter] = useState('');

  const unitsParams: UnitsQueryParams | undefined = validProjectId
    ? {
        project: validProjectId,
        status: statusFilter === 'all' ? undefined : statusFilter,
        unit_type: typeFilter === 'all' ? undefined : typeFilter,
        block: blockFilter === 'all' ? undefined : Number(blockFilter),
        floor_number: floorFilter.trim() ? Number(floorFilter) : undefined,
      }
    : undefined;
  const { data: unitsData, error: unitsError, isLoading: unitsLoading, isValidating: unitsValidating, mutate: mutateUnits } = useUnits(unitsParams);

  const blocks = blocksData?.results || [];
  const units = unitsData?.results || [];

  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [blockForm, setBlockForm] = useState<BlockCreateData | null>(null);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState<UnitCreateData | null>(null);
  const [saving, setSaving] = useState(false);

  const blockNameById = useMemo(() => {
    const map = new Map<number, string>();
    blocks.forEach(block => map.set(block.id, block.name));
    return map;
  }, [blocks]);

  const refreshAll = async () => {
    await Promise.all([mutateProject(), mutateSummary(), mutateBlocks(), mutateUnits()]);
  };

  const openCreateBlock = () => {
    if (!validProjectId) return;
    setEditingBlock(null);
    setBlockForm(emptyBlockForm(validProjectId));
    setBlockDialogOpen(true);
  };

  const openEditBlock = (block: Block) => {
    if (!validProjectId) return;
    setEditingBlock(block);
    setBlockForm(blockToForm(block, validProjectId));
    setBlockDialogOpen(true);
  };

  const saveBlock = async () => {
    if (!blockForm?.name.trim()) return;
    setSaving(true);
    try {
      if (editingBlock) await updateBlock(editingBlock.id, blockForm);
      else await createBlock(blockForm);
      await mutateBlocks();
      setBlockDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const removeBlock = async (block: Block) => {
    if (!window.confirm(`Delete block "${block.name}"?`)) return;
    await deleteBlock(block.id);
    await Promise.all([mutateBlocks(), mutateUnits()]);
  };

  const openCreateUnit = () => {
    if (!validProjectId) return;
    setEditingUnit(null);
    setUnitForm(emptyUnitForm(validProjectId));
    setUnitDialogOpen(true);
  };

  const openEditUnit = (unit: Unit) => {
    if (!validProjectId) return;
    setEditingUnit(unit);
    setUnitForm(unitToForm(unit, validProjectId));
    setUnitDialogOpen(true);
  };

  const cleanUnitPayload = (form: UnitCreateData): UnitCreateData => ({
    ...form,
    block: form.block || null,
    floor_number: form.floor_number ?? null,
    facing: form.facing || null,
    configuration: form.configuration || null,
    plot_dimensions: form.plot_dimensions || null,
    carpet_area_sqft: form.carpet_area_sqft ?? null,
    built_up_area_sqft: form.built_up_area_sqft ?? null,
    super_built_up_area_sqft: form.super_built_up_area_sqft ?? null,
    rate_per_sqft: form.rate_per_sqft ?? null,
    base_price: form.base_price ?? null,
    total_price: form.total_price ?? null,
  });

  const saveUnit = async () => {
    if (!unitForm?.unit_number.trim()) return;
    setSaving(true);
    try {
      const payload = cleanUnitPayload(unitForm);
      if (editingUnit) await updateUnit(editingUnit.id, payload);
      else await createUnit(payload);
      await Promise.all([mutateUnits(), mutateSummary()]);
      setUnitDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const removeUnit = async (unit: Unit) => {
    if (!window.confirm(`Delete unit "${unit.unit_number}"?`)) return;
    await deleteUnit(unit.id);
    await Promise.all([mutateUnits(), mutateSummary()]);
  };

  if (!validProjectId || projectError) {
    return (
      <div className="p-6 space-y-3">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate('/real-estate/projects')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Projects
        </Button>
        <p className="text-sm text-destructive">Failed to load project.</p>
      </div>
    );
  }

  if (projectLoading || !project) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-8 flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {project.image_url ? (
              <img src={project.image_url} alt={project.name} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
          <Button variant="ghost" size="sm" className="h-8 px-0 text-xs" onClick={() => navigate('/real-estate/projects')}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Projects
          </Button>
          <div className="flex items-center gap-2 mt-1">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">{project.name}</h1>
            <Badge variant="secondary">{labelize(project.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {[project.city, project.state, project.rera_number ? `RERA ${project.rera_number}` : null].filter(Boolean).join(' · ')}
          </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshAll} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <SummaryCard title="By Status" rows={summary?.unit_counts_by_status} />
        <SummaryCard title="By Type" rows={summary?.unit_counts_by_type} />
        <SummaryCard title="By Floor" rows={summary?.unit_counts_by_floor} />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Blocks</h2>
            <span className="text-xs text-muted-foreground">{blocks.length} total</span>
          </div>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={openCreateBlock}>
            <Plus className="h-3.5 w-3.5" /> Add Block
          </Button>
        </div>
        <div className="border rounded-lg">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No blocks yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Total Floors</TableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map(block => (
                  <TableRow key={block.id}>
                    <TableCell className="font-medium">{block.name}</TableCell>
                    <TableCell>{labelize(block.block_type)}</TableCell>
                    <TableCell>{block.total_floors}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBlock(block)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeBlock(block)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Units / Inventory</h2>
            <span className="text-xs text-muted-foreground">{unitsData?.count ?? units.length} total</span>
          </div>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={openCreateUnit}>
            <Plus className="h-3.5 w-3.5" /> Add Unit
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | UnitStatus)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {UNIT_STATUSES.map(status => <SelectItem key={status} value={status}>{labelize(status)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | UnitType)}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {UNIT_TYPES.map(type => <SelectItem key={type} value={type}>{labelize(type)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={blockFilter} onValueChange={setBlockFilter}>
            <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All blocks</SelectItem>
              {blocks.map(block => <SelectItem key={block.id} value={String(block.id)}>{block.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            className="h-8 w-[110px] text-xs"
            placeholder="Floor"
            inputMode="numeric"
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
          />
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => mutateUnits()} disabled={unitsValidating}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${unitsValidating ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        <div className="border rounded-lg">
          {unitsError ? (
            <p className="text-sm text-destructive text-center py-10">Failed to load units.</p>
          ) : unitsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : units.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">No units match these filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {units.map(unit => {
                  const blockId = relatedId(unit.block);
                  return (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.unit_number}</TableCell>
                      <TableCell>{blockId ? blockNameById.get(blockId) || relatedName(unit.block, 'Block') : '-'}</TableCell>
                      <TableCell>{unit.floor_number ?? '-'}</TableCell>
                      <TableCell>{labelize(unit.unit_type)}</TableCell>
                      <TableCell>{unit.configuration || '-'}</TableCell>
                      <TableCell>{unit.carpet_area_sqft ? `${unit.carpet_area_sqft} sqft` : '-'}</TableCell>
                      <TableCell>{money(unit.total_price || unit.base_price)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusTone[unit.status]}>
                          {labelize(unit.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUnit(unit)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeUnit(unit)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </section>

      <BlockDialog
        open={blockDialogOpen}
        onOpenChange={setBlockDialogOpen}
        form={blockForm}
        setForm={setBlockForm}
        editing={!!editingBlock}
        saving={saving}
        onSave={saveBlock}
      />

      <UnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        form={unitForm}
        setForm={setUnitForm}
        editing={!!editingUnit}
        saving={saving}
        blocks={blocks}
        onSave={saveUnit}
      />
    </div>
  );
};

const SummaryCard: React.FC<{ title: string; rows?: Record<string, number> }> = ({ title, rows }) => {
  const entries = Object.entries(rows || {}).filter(([, count]) => count > 0);
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground mt-2">No units</p>
      ) : (
        <div className="mt-2 space-y-1">
          {entries.map(([key, count]) => (
            <div key={key} className="flex justify-between text-sm">
              <span>{labelize(key)}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BlockDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: BlockCreateData | null;
  setForm: React.Dispatch<React.SetStateAction<BlockCreateData | null>>;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
}> = ({ open, onOpenChange, form, setForm, editing, saving, onSave }) => (
  <SideDrawer
    open={open}
    onOpenChange={onOpenChange}
    title={editing ? 'Edit block' : 'Add block'}
    description="Group units by tower, wing, phase, sector, or block."
    mode={editing ? 'edit' : 'create'}
    size="md"
    footerAlignment="right"
    storageKey="real-estate-block-drawer"
    footerButtons={[
      {
        label: 'Cancel',
        onClick: () => onOpenChange(false),
        variant: 'outline',
        disabled: saving,
      },
      {
        label: editing ? 'Save Block' : 'Add Block',
        onClick: onSave,
        loading: saving,
        disabled: !form?.name.trim(),
      },
    ] satisfies DrawerActionButton[]}
  >
      {form && (
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm(current => current && ({ ...current, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.block_type} onValueChange={(v) => setForm(current => current && ({ ...current, block_type: v as BlockType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BLOCK_TYPES.map(type => <SelectItem key={type} value={type}>{labelize(type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Total Floors</Label>
            <Input
              type="number"
              min={0}
              value={form.total_floors}
              onChange={(e) => setForm(current => current && ({ ...current, total_floors: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>
      )}
  </SideDrawer>
);

const UnitDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UnitCreateData | null;
  setForm: React.Dispatch<React.SetStateAction<UnitCreateData | null>>;
  editing: boolean;
  saving: boolean;
  blocks: Block[];
  onSave: () => void;
}> = ({ open, onOpenChange, form, setForm, editing, saving, blocks, onSave }) => {
  const setField = <K extends keyof UnitCreateData>(key: K, value: UnitCreateData[K]) => {
    setForm(current => current && ({ ...current, [key]: value }));
  };

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Edit unit' : 'Add unit'}
      description="Maintain floor-wise inventory, pricing, and availability status."
      mode={editing ? 'edit' : 'create'}
      size="lg"
      footerAlignment="right"
      storageKey="real-estate-unit-drawer"
      footerButtons={[
        {
          label: 'Cancel',
          onClick: () => onOpenChange(false),
          variant: 'outline',
          disabled: saving,
        },
        {
          label: editing ? 'Save Unit' : 'Add Unit',
          onClick: onSave,
          loading: saving,
          disabled: !form?.unit_number.trim(),
        },
      ] satisfies DrawerActionButton[]}
    >
        {form && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Unit Number</Label>
              <Input value={form.unit_number} onChange={(e) => setField('unit_number', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Block</Label>
              <Select value={form.block ? String(form.block) : 'none'} onValueChange={(v) => setField('block', v === 'none' ? null : Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No block</SelectItem>
                  {blocks.map(block => <SelectItem key={block.id} value={String(block.id)}>{block.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Floor</Label>
              <Input type="number" value={form.floor_number ?? ''} onChange={(e) => setField('floor_number', numberOrNull(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Unit Type</Label>
              <Select value={form.unit_type} onValueChange={(v) => setField('unit_type', v as UnitType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES.map(type => <SelectItem key={type} value={type}>{labelize(type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status || UnitStatus.AVAILABLE} onValueChange={(v) => setField('status', v as UnitStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_STATUSES.map(status => <SelectItem key={status} value={status}>{labelize(status)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Facing</Label>
              <Select value={form.facing || 'none'} onValueChange={(v) => setField('facing', v === 'none' ? null : v as UnitFacing)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {UNIT_FACINGS.map(facing => <SelectItem key={facing} value={facing}>{labelize(facing)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Configuration</Label>
              <Input placeholder="2 BHK, 3 BHK, 30x40" value={form.configuration || ''} onChange={(e) => setField('configuration', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Carpet Area (sqft)</Label>
              <Input type="number" value={form.carpet_area_sqft ?? ''} onChange={(e) => setField('carpet_area_sqft', numberOrNull(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Built-up Area (sqft)</Label>
              <Input type="number" value={form.built_up_area_sqft ?? ''} onChange={(e) => setField('built_up_area_sqft', numberOrNull(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Super Built-up Area</Label>
              <Input type="number" value={form.super_built_up_area_sqft ?? ''} onChange={(e) => setField('super_built_up_area_sqft', numberOrNull(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Plot Dimensions</Label>
              <Input value={form.plot_dimensions || ''} onChange={(e) => setField('plot_dimensions', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rate / sqft</Label>
              <Input type="number" value={form.rate_per_sqft ?? ''} onChange={(e) => setField('rate_per_sqft', numberOrNull(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Base Price</Label>
              <Input type="number" value={form.base_price ?? ''} onChange={(e) => setField('base_price', numberOrNull(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Total Price</Label>
              <Input type="number" value={form.total_price ?? ''} onChange={(e) => setField('total_price', numberOrNull(e.target.value))} />
            </div>
          </div>
        )}
    </SideDrawer>
  );
};

export default ProjectDetailPage;
