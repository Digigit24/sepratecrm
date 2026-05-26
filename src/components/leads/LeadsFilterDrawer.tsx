// src/components/leads/LeadsFilterDrawer.tsx
import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { X, ChevronDown, Save, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/client';
import { API_CONFIG } from '@/lib/apiConfig';
import type { LeadStatus } from '@/types/crmTypes';
import type {
  FilterFieldDef,
  FilterPlacement,
  CrmLeadsFilterConfig,
  ActiveFilters,
} from '@/types/filterTypes';

interface LeadsFilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filterDefs: FilterFieldDef[];
  statuses: LeadStatus[];
  activeFilters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  config: CrmLeadsFilterConfig;
  onSaveForMe: (config: CrmLeadsFilterConfig) => Promise<void>;
  onSaveForEveryone: (config: CrmLeadsFilterConfig) => Promise<void>;
  isSaving: boolean;
}

const PRIORITY_OPTIONS = [
  { value: 'HIGH', label: 'High', color: 'text-red-600' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-yellow-600' },
  { value: 'LOW', label: 'Low', color: 'text-green-600' },
];

const LEAD_SCORE_OPTIONS = [
  { value: 'no_score', label: 'No Score' },
  { value: 'below_25', label: 'Below 25' },
  { value: '25_to_50', label: '25 – 50' },
  { value: '50_to_75', label: '50 – 75' },
  { value: '75_above', label: '75+' },
];

const PLACEMENT_OPTIONS: { value: FilterPlacement; label: string }[] = [
  { value: 'tabs', label: 'Tabs Row' },
  { value: 'toolbar', label: 'Toolbar' },
  { value: 'drawer', label: 'Drawer Only' },
  { value: 'hidden', label: 'Hidden' },
];

// Count active filters
export function countActiveFilters(filters: ActiveFilters): number {
  return Object.entries(filters).filter(([, v]) => {
    if (v === undefined || v === null || v === '' || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  }).length;
}

export const LeadsFilterDrawer: React.FC<LeadsFilterDrawerProps> = ({
  open,
  onOpenChange,
  filterDefs,
  statuses,
  activeFilters,
  onFiltersChange,
  config,
  onSaveForMe,
  onSaveForEveryone,
  isSaving,
}) => {
  const [tab, setTab] = useState<'filters' | 'configure'>('filters');
  const [localConfig, setLocalConfig] = useState<CrmLeadsFilterConfig>(config);

  // Sync localConfig when outer config changes
  useMemo(() => setLocalConfig(config), [config]);

  // Fetch users for owner filter
  const { data: usersData } = useSWR(
    open ? 'leads-filter-users' : null,
    () => authClient.get(`${API_CONFIG.AUTH.USERS.LIST}?page_size=100`).then(r => r.data),
    { revalidateOnFocus: false }
  );

  const users: Array<{ id: string; full_name?: string; email: string }> =
    usersData?.results || [];

  // Non-hidden filter defs ordered by config
  const orderedFilterDefs = useMemo(() => {
    const placementMap = new Map(localConfig.fields.map(f => [f.key, f.placement]));
    return filterDefs
      .filter(def => {
        const placement = placementMap.get(def.key) ?? 'drawer';
        return placement !== 'hidden';
      })
      .sort((a, b) => {
        const ia = localConfig.fields.findIndex(f => f.key === a.key);
        const ib = localConfig.fields.findIndex(f => f.key === b.key);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
  }, [filterDefs, localConfig]);

  const setFilter = (key: string, value: any) => {
    onFiltersChange({ ...activeFilters, [key]: value });
  };

  const clearFilter = (keys: string[]) => {
    const next = { ...activeFilters };
    keys.forEach(k => delete next[k]);
    onFiltersChange(next);
  };

  const clearAll = () => onFiltersChange({});

  const activeCount = countActiveFilters(activeFilters);

  const getPlacement = (key: string): FilterPlacement => {
    return localConfig.fields.find(f => f.key === key)?.placement ?? 'drawer';
  };

  const setPlacement = (key: string, placement: FilterPlacement) => {
    setLocalConfig(prev => {
      const existing = prev.fields.find(f => f.key === key);
      if (existing) {
        return { ...prev, fields: prev.fields.map(f => f.key === key ? { ...f, placement } : f) };
      }
      return { ...prev, fields: [...prev.fields, { key, placement }] };
    });
  };

  const handleSave = async (scope: 'me' | 'everyone') => {
    try {
      if (scope === 'me') {
        await onSaveForMe(localConfig);
        toast.success('Filter layout saved for you');
      } else {
        await onSaveForEveryone(localConfig);
        toast.success('Filter layout saved for everyone');
      }
    } catch {
      toast.error('Failed to save filter layout');
    }
  };

  // ─── Render per-type filter UI ───────────────────────────────────────────────
  const renderFilterInput = (def: FilterFieldDef) => {
    switch (def.filterType) {
      case 'multi_status': {
        const selected: number[] = activeFilters.status || [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {statuses.map(s => {
              const isSelected = selected.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    const next = isSelected
                      ? selected.filter(id => id !== s.id)
                      : [...selected, s.id];
                    setFilter('status', next.length ? next : undefined);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected ? 'opacity-100 ring-2 ring-offset-1' : 'opacity-60 hover:opacity-90'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${s.color_hex || '#6B7280'}20` : 'transparent',
                    borderColor: s.color_hex || '#6B7280',
                    color: s.color_hex || '#6B7280',
                    ...(isSelected ? { ringColor: s.color_hex || '#6B7280' } : {}),
                  }}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        );
      }

      case 'multi_priority': {
        const selected: string[] = activeFilters.priority || [];
        return (
          <div className="flex gap-1.5">
            {PRIORITY_OPTIONS.map(opt => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => {
                    const next = isSelected
                      ? selected.filter(v => v !== opt.value)
                      : [...selected, opt.value];
                    setFilter('priority', next.length ? next : undefined);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-muted border-foreground/30'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        );
      }

      case 'lead_score_range': {
        const selected = activeFilters.lead_score;
        return (
          <div className="flex flex-wrap gap-1.5">
            {LEAD_SCORE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilter('lead_score', selected === opt.value ? undefined : opt.value)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
                  selected === opt.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      }

      case 'user_select': {
        return (
          <Select
            value={activeFilters.owner_user_id || '__any__'}
            onValueChange={v => setFilter('owner_user_id', v === '__any__' ? undefined : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Any owner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any owner</SelectItem>
              {users.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case 'text_contains': {
        const val = def.isCustom
          ? activeFilters[`meta_${def.key}`] || ''
          : activeFilters[def.key] || '';
        const filterKey = def.isCustom ? `meta_${def.key}` : def.key;
        return (
          <Input
            className="h-8 text-xs"
            placeholder={`Search ${def.label.toLowerCase()}…`}
            value={val}
            onChange={e => setFilter(filterKey, e.target.value || undefined)}
          />
        );
      }

      case 'date_range': {
        const baseKey = def.isCustom ? `meta_${def.key}` : def.key;
        const gteKey = `${baseKey}_gte`;
        const lteKey = `${baseKey}_lte`;
        const isnullKey = `${baseKey}_isnull`;
        return (
          <div className="space-y-1.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">From</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={activeFilters[gteKey] || ''}
                  onChange={e => setFilter(gteKey, e.target.value || undefined)}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">To</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={activeFilters[lteKey] || ''}
                  onChange={e => setFilter(lteKey, e.target.value || undefined)}
                />
              </div>
            </div>
            {def.key === 'next_follow_up_at' && (
              <div className="flex items-center gap-2 mt-1">
                <Switch
                  id={`${def.key}-isnull`}
                  checked={activeFilters[isnullKey] === true}
                  onCheckedChange={v => setFilter(isnullKey, v ? true : undefined)}
                  className="scale-75"
                />
                <Label htmlFor={`${def.key}-isnull`} className="text-xs cursor-pointer">
                  No follow-up scheduled
                </Label>
              </div>
            )}
          </div>
        );
      }

      case 'number_range': {
        const baseKey = def.isCustom ? `meta_${def.key}` : def.key;
        const minKey = `${baseKey}_min`;
        const maxKey = `${baseKey}_max`;
        return (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground">Min</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="0"
                value={activeFilters[minKey] ?? ''}
                onChange={e => setFilter(minKey, e.target.value !== '' ? Number(e.target.value) : undefined)}
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground">Max</Label>
              <Input
                type="number"
                className="h-8 text-xs"
                placeholder="∞"
                value={activeFilters[maxKey] ?? ''}
                onChange={e => setFilter(maxKey, e.target.value !== '' ? Number(e.target.value) : undefined)}
              />
            </div>
          </div>
        );
      }

      case 'boolean_toggle': {
        const filterKey = def.isCustom ? `meta_${def.key}` : def.key;
        return (
          <div className="flex items-center gap-2">
            <Switch
              id={`filter-${def.key}`}
              checked={activeFilters[filterKey] === true}
              onCheckedChange={v => setFilter(filterKey, v ? true : undefined)}
            />
            <Label htmlFor={`filter-${def.key}`} className="text-xs cursor-pointer">
              {activeFilters[filterKey] ? 'Enabled' : 'Disabled'}
            </Label>
          </div>
        );
      }

      case 'single_select': {
        const filterKey = def.isCustom ? `meta_${def.key}` : def.key;
        const opts = def.options || def.fieldConfig?.options || [];
        return (
          <Select
            value={activeFilters[filterKey] || '__any__'}
            onValueChange={v => setFilter(filterKey, v === '__any__' ? undefined : v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder={`Any ${def.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any</SelectItem>
              {opts.map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }

      case 'multi_select': {
        const filterKey = def.isCustom ? `meta_${def.key}` : def.key;
        const opts = def.options || def.fieldConfig?.options || [];
        const selected: string[] = activeFilters[filterKey] || [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {opts.map((opt: string) => {
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => {
                    const next = isSelected
                      ? selected.filter(v => v !== opt)
                      : [...selected, opt];
                    setFilter(filterKey, next.length ? next : undefined);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        );
      }

      default:
        return null;
    }
  };

  const getFilterClearKeys = (def: FilterFieldDef): string[] => {
    const baseKey = def.isCustom ? `meta_${def.key}` : def.key;
    switch (def.filterType) {
      case 'multi_status': return ['status'];
      case 'multi_priority': return ['priority'];
      case 'lead_score_range': return ['lead_score'];
      case 'user_select': return ['owner_user_id'];
      case 'date_range': return [`${baseKey}_gte`, `${baseKey}_lte`, `${baseKey}_isnull`];
      case 'number_range': return [`${baseKey}_min`, `${baseKey}_max`];
      default: return [baseKey];
    }
  };

  const isFilterActive = (def: FilterFieldDef): boolean => {
    return getFilterClearKeys(def).some(k => {
      const v = activeFilters[k];
      if (v === undefined || v === null || v === '' || v === false) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[420px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SheetTitle className="text-sm font-semibold">Filters</SheetTitle>
              {activeCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {activeCount} active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {activeCount > 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={clearAll}>
                  Clear all
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2 gap-1" disabled={isSaving}>
                    <Save className="h-3 w-3" />
                    Save layout
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSave('me')}>
                    Save for me
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSave('everyone')}>
                    Save for everyone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </SheetHeader>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={v => setTab(v as 'filters' | 'configure')} className="flex flex-col flex-1 min-h-0">
          <TabsList className="h-8 mx-4 mt-2 mb-0 flex-shrink-0">
            <TabsTrigger value="filters" className="text-xs flex-1">Apply Filters</TabsTrigger>
            <TabsTrigger value="configure" className="text-xs flex-1 gap-1">
              <Settings2 className="h-3 w-3" />
              Configure Layout
            </TabsTrigger>
          </TabsList>

          {/* ─── Apply Filters Tab ─────────────────────────────── */}
          <TabsContent value="filters" className="flex-1 overflow-y-auto px-4 py-3 space-y-4 mt-0">
            {orderedFilterDefs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">
                No filters enabled. Go to "Configure Layout" to add filters.
              </p>
            )}
            {orderedFilterDefs.map(def => (
              <div key={def.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {def.label}
                    {def.isCustom && (
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">(custom)</span>
                    )}
                  </Label>
                  {isFilterActive(def) && (
                    <button
                      onClick={() => clearFilter(getFilterClearKeys(def))}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                      clear
                    </button>
                  )}
                </div>
                {renderFilterInput(def)}
              </div>
            ))}
          </TabsContent>

          {/* ─── Configure Layout Tab ──────────────────────────── */}
          <TabsContent value="configure" className="flex-1 overflow-y-auto px-4 py-3 space-y-1 mt-0">
            <p className="text-[11px] text-muted-foreground mb-3">
              Choose where each filter appears. Save layout to persist your choices.
            </p>
            {filterDefs.map((def, i) => (
              <div key={def.key}>
                {i > 0 && <Separator className="my-1" />}
                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-xs font-medium">{def.label}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {def.isCustom ? 'custom · ' : ''}{def.filterType.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Select
                    value={getPlacement(def.key)}
                    onValueChange={v => setPlacement(def.key, v as FilterPlacement)}
                  >
                    <SelectTrigger className="h-7 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLACEMENT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <div className="pt-3 pb-2">
              <Separator className="mb-3" />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  disabled={isSaving}
                  onClick={() => handleSave('me')}
                >
                  Save for me
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  disabled={isSaving}
                  onClick={() => handleSave('everyone')}
                >
                  Save for everyone
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};
