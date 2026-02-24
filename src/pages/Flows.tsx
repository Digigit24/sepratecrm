// src/pages/Flows.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlows, useFlowMutations, useFlowStats } from '@/hooks/whatsapp/useFlows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  RefreshCw,
  ArrowLeft,
  Search,
  X,
  Edit,
  Trash2,
  Copy,
  CheckCircle2,
  Eye,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { toast } from 'sonner';
import type { Flow, FlowStatus, FlowCategory } from '@/types/whatsappTypes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const getStatusColor = (status: FlowStatus) => {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'DRAFT':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'DEPRECATED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getCategoryLabel = (category: FlowCategory) => {
  return category.replace(/_/g, ' ');
};

export default function Flows() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FlowStatus | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<FlowCategory | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Build query
  const query = {
    page,
    page_size: pageSize,
    ...(searchQuery && { search: searchQuery }),
    ...(statusFilter !== 'ALL' && { status: statusFilter as FlowStatus }),
    ...(categoryFilter !== 'ALL' && { category: categoryFilter as FlowCategory }),
  };

  const { flows, total, isLoading, error, revalidate } = useFlows(query);
  const { stats } = useFlowStats();
  const { deleteFlow, duplicateFlow, publishFlow, unpublishFlow } = useFlowMutations();

  const handleRefresh = async () => {
    await revalidate();
    toast.success('Flows refreshed');
  };

  const handleCreate = () => {
    navigate('/whatsapp/flows/new');
  };

  const handleEdit = (flow: Flow) => {
    navigate(`/whatsapp/flows/${flow.flow_id}`);
  };

  const handleView = (flow: Flow) => {
    navigate(`/whatsapp/flows/${flow.flow_id}/view`);
  };

  const handleDelete = async (flow: Flow) => {
    if (!confirm(`Are you sure you want to delete "${flow.name}"?`)) {
      return;
    }

    try {
      await deleteFlow(flow.flow_id);
      toast.success('Flow deleted successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete flow');
    }
  };

  const handleDuplicate = async (flow: Flow) => {
    try {
      const duplicated = await duplicateFlow(flow.flow_id, `${flow.name} (Copy)`);
      toast.success('Flow duplicated successfully');
      navigate(`/whatsapp/flows/${duplicated.flow_id}`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to duplicate flow');
    }
  };

  const handlePublish = async (flow: Flow) => {
    try {
      await publishFlow(flow.flow_id);
      toast.success('Flow published successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to publish flow');
    }
  };

  const handleUnpublish = async (flow: Flow) => {
    try {
      await unpublishFlow(flow.flow_id);
      toast.success('Flow unpublished successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to unpublish flow');
    }
  };

  const handleSearch = () => {
    setPage(1);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setPage(1);
  };

  if (isLoading && flows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading flows...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Flows</h3>
          <p className="text-sm text-destructive/80">{error.message || 'Failed to fetch flow data'}</p>
          <Button onClick={handleRefresh} variant="outline" className="mt-4 w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Flows</h1>
          <span className="text-xs text-muted-foreground">{total} total</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreate} size="sm" className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Flow
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search flows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-8 pr-8 h-8 text-xs"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-6 w-6"
              onClick={handleClearSearch}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
          <SelectTrigger className="w-[110px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="DEPRECATED">Deprecated</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(value: any) => setCategoryFilter(value)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Categories</SelectItem>
            <SelectItem value="SIGN_UP">Sign Up</SelectItem>
            <SelectItem value="SIGN_IN">Sign In</SelectItem>
            <SelectItem value="APPOINTMENT_BOOKING">Appointment</SelectItem>
            <SelectItem value="LEAD_GENERATION">Lead Gen</SelectItem>
            <SelectItem value="CONTACT_US">Contact Us</SelectItem>
            <SelectItem value="CUSTOMER_SUPPORT">Support</SelectItem>
            <SelectItem value="SURVEY">Survey</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        {flows.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-xs text-muted-foreground mb-3">No flows found</div>
              <Button onClick={handleCreate} size="sm" className="h-7 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Flow
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium">Name</th>
                  <th className="text-left px-3 py-2 text-xs font-medium">Category</th>
                  <th className="text-left px-3 py-2 text-xs font-medium">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium">Screens</th>
                  <th className="text-left px-3 py-2 text-xs font-medium">Updated</th>
                  <th className="text-right px-3 py-2 text-xs font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((flow) => (
                  <tr key={flow.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="text-sm font-medium">{flow.name}</div>
                      {flow.description && (
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{flow.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {getCategoryLabel(flow.category)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={`text-[10px] ${getStatusColor(flow.status)}`}>
                        {flow.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {flow.flow_json.screens.length}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(flow.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(flow)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleView(flow)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(flow)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          {flow.status === 'DRAFT' ? (
                            <DropdownMenuItem onClick={() => handlePublish(flow)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleUnpublish(flow)}>
                              <X className="h-4 w-4 mr-2" />
                              Unpublish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(flow)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > pageSize && (
          <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setPage(page + 1)}
                disabled={page * pageSize >= total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
