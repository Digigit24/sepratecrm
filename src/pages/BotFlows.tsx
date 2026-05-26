// src/pages/BotFlows.tsx
// Bot Flows list page

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, RefreshCw, Bot, Zap, Activity, Users,
  Pencil, Trash2, ChevronRight, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useBotFlows } from '@/hooks/whatsapp/useBotFlows';
import type { BotFlow } from '@/types/botFlowTypes';

export default function BotFlows() {
  const navigate = useNavigate();
  const { flows, total, isLoading, fetchFlows, createFlow, deleteFlow, toggleStatus } = useBotFlows();

  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BotFlow | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({ title: '', start_trigger: '' });

  const filtered = flows.filter((f) =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.start_trigger.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeFlows = flows.filter((f) => f.is_active).length;
  const totalNodes = flows.reduce((sum, f) => sum + (f.node_count || 0), 0);

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.start_trigger.trim()) return;
    setIsCreating(true);
    const flow = await createFlow(formData);
    setIsCreating(false);
    if (flow) {
      setCreateOpen(false);
      setFormData({ title: '', start_trigger: '' });
      navigate(`/whatsapp/bot-flows/${flow._uid}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteFlow(deleteTarget._uid);
    setDeleteTarget(null);
  };

  const handleToggleStatus = async (flow: BotFlow) => {
    await toggleStatus(flow._uid, !flow.is_active);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div>
          <h1 className="text-2xl font-semibold">Bot Flows</h1>
          <p className="text-sm text-muted-foreground">Build automated conversation flows triggered by keywords</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFlows} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Flow
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Bot} label="Total Flows" value={total} color="blue" />
          <StatCard icon={Zap} label="Active Flows" value={activeFlows} color="green" />
          <StatCard icon={Activity} label="Total Nodes" value={totalNodes} color="purple" />
          <StatCard icon={Users} label="All Flows" value={flows.length} color="orange" />
        </div>

        {/* Search + Table */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center gap-3 p-4 border-b">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search flows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading flows...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <Bot className="h-10 w-10 opacity-40" />
              <p className="font-medium">No bot flows found</p>
              <p className="text-sm">Create your first flow to automate conversations</p>
              <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Flow
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left font-medium px-4 py-3 text-muted-foreground">Name</th>
                  <th className="text-left font-medium px-4 py-3 text-muted-foreground">Start Trigger</th>
                  <th className="text-left font-medium px-4 py-3 text-muted-foreground">Nodes</th>
                  <th className="text-left font-medium px-4 py-3 text-muted-foreground">Status</th>
                  <th className="text-left font-medium px-4 py-3 text-muted-foreground">Last Modified</th>
                  <th className="text-right font-medium px-4 py-3 text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((flow) => (
                  <tr key={flow._uid} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate(`/whatsapp/bot-flows/${flow._uid}`)}
                        className="font-medium hover:text-primary hover:underline flex items-center gap-1"
                      >
                        {flow.title}
                        <ChevronRight className="h-3 w-3 opacity-50" />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        {flow.start_trigger}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-muted-foreground">{flow.node_count ?? 0}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={flow.is_active}
                          onCheckedChange={() => handleToggleStatus(flow)}
                        />
                        <span className={flow.is_active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {flow.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {flow.updated_at
                        ? formatDistanceToNow(new Date(flow.updated_at), { addSuffix: true })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(`/whatsapp/bot-flows/${flow._uid}`)}
                          title="Edit flow"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(flow)}
                          title="Delete flow"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create Flow Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Bot Flow</DialogTitle>
            <DialogDescription>
              Set a title and the keyword that triggers this flow when a contact sends it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="flow-title">Flow Title <span className="text-destructive">*</span></Label>
              <Input
                id="flow-title"
                placeholder="e.g. Welcome Flow"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-trigger">
                Start Trigger Keyword <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start-trigger"
                placeholder="e.g. hello, start, hi"
                value={formData.start_trigger}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, start_trigger: e.target.value.toLowerCase() }))
                }
              />
              <p className="text-xs text-muted-foreground">
                When a contact sends this keyword, the flow begins.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating || !formData.title.trim() || !formData.start_trigger.trim()}
            >
              {isCreating ? 'Creating...' : 'Create & Open Builder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Bot Flow</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This will also
              delete all nodes in this flow. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete Flow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
