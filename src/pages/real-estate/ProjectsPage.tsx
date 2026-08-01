// src/pages/real-estate/ProjectsPage.tsx
import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Edit, ImageIcon, LayoutGrid, List, Loader2, Plus, RefreshCw, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
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
import { useAuth } from '@/hooks/useAuth';
import { useRealEstate } from '@/hooks/useRealEstate';
import { useTenant } from '@/hooks/useTenant';
import {
  ProjectStatus,
  ProjectType,
  type Project,
  type ProjectCreateData,
} from '@/types/realEstate.types';

const PROJECT_TYPE_OPTIONS = Object.values(ProjectType);
const PROJECT_STATUS_OPTIONS = Object.values(ProjectStatus);

const labelize = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const statusTone: Partial<Record<ProjectStatus, string>> = {
  [ProjectStatus.READY_TO_MOVE]: 'bg-green-100 text-green-700 hover:bg-green-100',
  [ProjectStatus.UNDER_CONSTRUCTION]: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  [ProjectStatus.ON_HOLD]: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  [ProjectStatus.COMPLETED]: 'bg-muted text-muted-foreground hover:bg-muted',
};

type ProjectViewMode = 'list' | 'grid';

const PROJECT_VIEW_STORAGE_KEY = 'real-estate-projects-view-mode';

const getInitialViewMode = (): ProjectViewMode => {
  if (typeof window === 'undefined') return 'list';
  return window.localStorage.getItem(PROJECT_VIEW_STORAGE_KEY) === 'grid' ? 'grid' : 'list';
};

const ProjectImageThumb: React.FC<{
  imageUrl?: string | null;
  className?: string;
  iconClassName?: string;
}> = ({ imageUrl, className = 'h-10 w-10 rounded-md', iconClassName = 'h-4 w-4' }) => (
  <div className={`overflow-hidden border bg-muted flex items-center justify-center ${className}`}>
    {imageUrl ? (
      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
    ) : (
      <Building2 className={`text-muted-foreground ${iconClassName}`} />
    )}
  </div>
);

const emptyForm = (): ProjectCreateData => ({
  name: '',
  project_type: ProjectType.RESIDENTIAL,
  status: ProjectStatus.PLANNING,
  description: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  country: 'India',
  postal_code: '',
  latitude: null,
  longitude: null,
  rera_number: '',
  possession_date: null,
});

const toForm = (project: Project): ProjectCreateData => ({
  name: project.name,
  project_type: project.project_type,
  status: project.status,
  description: project.description || '',
  address_line1: project.address_line1 || '',
  address_line2: project.address_line2 || '',
  city: project.city || '',
  state: project.state || '',
  country: project.country || 'India',
  postal_code: project.postal_code || '',
  latitude: project.latitude,
  longitude: project.longitude,
  rera_number: project.rera_number || '',
  possession_date: project.possession_date,
});

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { useTenantDetail } = useTenant();
  const { data: tenant } = useTenantDetail(user?.tenant?.id || null);
  const {
    useProjects,
    createProject,
    updateProject,
    deleteProject,
    uploadProjectImage,
    deleteProjectImage,
  } = useRealEstate();
  const { data, error, isLoading, isValidating, mutate } = useProjects();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectCreateData>(() => emptyForm());
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ProjectViewMode>(() => getInitialViewMode());
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);

  const projects = data?.results || [];
  const count = data?.count ?? 0;
  const zataConfig = tenant?.settings?.zata_config || {};
  const workspaceBucket = zataConfig.workspace_bucket || '';
  const zataFolderId = zataConfig.folder_id || '';

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setImageUploadProgress(0);
    setDialogOpen(true);
  };

  const openEdit = (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditing(project);
    setForm(toForm(project));
    setImageUploadProgress(0);
    setDialogOpen(true);
  };

  const handleDelete = async (project: Project, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm(`Delete project "${project.name}"?`)) return;
    await deleteProject(project.id);
    await mutate();
  };

  const setField = <K extends keyof ProjectCreateData>(key: K, value: ProjectCreateData[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const changeViewMode = (mode: ProjectViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(PROJECT_VIEW_STORAGE_KEY, mode);
  };

  const handleProjectImageUpload = async (file: File) => {
    if (!editing) {
      toast.error('Save the project before uploading a cover image.');
      return;
    }

    if (!workspaceBucket || !zataFolderId) {
      toast.error(
        'Tenant preferences mapping missing in SuperAdmin settings. Please configure zata_config inside preferences.',
        { duration: 6000 }
      );
      return;
    }

    setImageUploading(true);
    setImageUploadProgress(10);
    try {
      const updated = await uploadProjectImage(editing.id, file, {
        workspaceBucket,
        zataFolderId,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || progressEvent.loaded)
          );
          setImageUploadProgress(Math.min(percentCompleted, 95));
        },
      });
      setImageUploadProgress(100);
      setEditing(updated);
      await mutate();
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleProjectImageDelete = async () => {
    if (!editing) return;
    await deleteProjectImage(editing.id);
    setEditing(current => current ? { ...current, image_url: null } : current);
    await mutate();
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload: ProjectCreateData = {
        ...form,
        possession_date: form.possession_date || null,
        description: form.description || null,
        address_line2: form.address_line2 || null,
        rera_number: form.rera_number || null,
      };
      if (editing) {
        await updateProject(editing.id, payload);
      } else {
        await createProject(payload);
      }
      await mutate();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const footerButtons: DrawerActionButton[] = [
    {
      label: 'Cancel',
      onClick: () => setDialogOpen(false),
      variant: 'outline',
      disabled: saving,
    },
    {
      label: editing ? 'Save Project' : 'Create Project',
      onClick: handleSubmit,
      loading: saving,
      disabled: !form.name.trim(),
    },
  ];

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-base font-semibold">Real Estate Projects</h1>
          <span className="text-xs text-muted-foreground">{count} total</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => changeViewMode('list')}
              title="List view"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-7 w-7"
              onClick={() => changeViewMode('grid')}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => mutate()} disabled={isValidating} title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        {error ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <p className="text-sm text-destructive">Failed to load projects.</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => mutate()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : sortedProjects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <Button size="sm" className="mt-3 h-8 text-xs" onClick={openCreate}>Create project</Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
            {sortedProjects.map(project => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                className="group overflow-hidden rounded-lg border bg-card text-left shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={() => navigate(`/real-estate/projects/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    navigate(`/real-estate/projects/${project.id}`);
                  }
                }}
              >
                <div className="relative aspect-video bg-muted">
                  {project.image_url ? (
                    <img src={project.image_url} alt={project.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:transition group-hover:opacity-100">
                    <Button variant="secondary" size="icon" className="h-7 w-7 shadow-sm" onClick={(e) => openEdit(project, e)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-7 w-7 text-destructive shadow-sm" onClick={(e) => handleDelete(project, e)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <div className="space-y-1">
                    <h2 className="line-clamp-1 text-sm font-semibold">{project.name}</h2>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{project.city || project.state || 'Location not set'}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{labelize(project.project_type)}</Badge>
                    <Badge variant="secondary" className={statusTone[project.status]}>
                      {labelize(project.status)}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Possession: <span className="font-medium text-foreground">{project.possession_date || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Cover</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Possession</TableHead>
                <TableHead className="w-[90px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProjects.map(project => (
                <TableRow
                  key={project.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/real-estate/projects/${project.id}`)}
                >
                  <TableCell>
                    <ProjectImageThumb imageUrl={project.image_url} />
                  </TableCell>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>{labelize(project.project_type)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusTone[project.status]}>
                      {labelize(project.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.city || '-'}</TableCell>
                  <TableCell>{project.possession_date || '-'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openEdit(project, e)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => handleDelete(project, e)}>
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

      <SideDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? 'Edit project' : 'Create project'}
        description="Manage project identity, address, RERA, and possession details."
        mode={editing ? 'edit' : 'create'}
        size="lg"
        footerButtons={footerButtons}
        footerAlignment="right"
        storageKey="real-estate-project-drawer"
      >
          <div className="mb-5 rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <ProjectImageThumb
                imageUrl={editing?.image_url}
                className="h-28 w-full rounded-lg sm:h-24 sm:w-36"
                iconClassName="h-7 w-7"
              />
              <div className="flex-1 space-y-2">
                <div>
                  <Label>Cover Image</Label>
                  <p className="text-xs text-muted-foreground">
                    {editing ? 'Upload a project cover image using the tenant Zata mapping.' : 'Create the project first, then edit it to upload a cover image.'}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleProjectImageUpload(file);
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={!editing || imageUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imageUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    {imageUploading ? `Uploading ${imageUploadProgress}%` : editing?.image_url ? 'Replace Image' : 'Upload Image'}
                  </Button>
                  {editing?.image_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs gap-1 text-destructive"
                      disabled={imageUploading}
                      onClick={handleProjectImageDelete}
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setField('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Project Type</Label>
              <Select value={form.project_type} onValueChange={(v) => setField('project_type', v as ProjectType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPE_OPTIONS.map(type => <SelectItem key={type} value={type}>{labelize(type)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setField('status', v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS_OPTIONS.map(status => <SelectItem key={status} value={status}>{labelize(status)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description || ''} onChange={(e) => setField('description', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address Line 1</Label>
              <Input value={form.address_line1} onChange={(e) => setField('address_line1', e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Address Line 2</Label>
              <Input value={form.address_line2 || ''} onChange={(e) => setField('address_line2', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setField('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state} onChange={(e) => setField('state', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.country} onChange={(e) => setField('country', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input value={form.postal_code} onChange={(e) => setField('postal_code', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>RERA Number</Label>
              <Input value={form.rera_number || ''} onChange={(e) => setField('rera_number', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Possession Date</Label>
              <Input type="date" value={form.possession_date || ''} onChange={(e) => setField('possession_date', e.target.value || null)} />
            </div>
          </div>
      </SideDrawer>
    </div>
  );
};

export default ProjectsPage;
