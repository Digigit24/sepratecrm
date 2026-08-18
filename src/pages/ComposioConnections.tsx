// src/pages/ComposioConnections.tsx
//
// Route `/integrations/composio/admin` — the tenant-admin oversight table of
// every Composio connection in the workspace (plan §C.1 #18/#18b).
//
// "Admin" here means TENANT admin: the backend queryset is still scoped to
// `tenant_id`, so this can never show another tenant's connections.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, ArrowLeft, Blocks, Info, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionGate } from '@/components/PermissionGate';
import { ConnectionStatusBadge } from '@/components/composio/ConnectionStatusBadge';
import { DisconnectConfirmDialog } from '@/components/composio/DisconnectConfirmDialog';
import { useComposio } from '@/hooks/useComposio';
import {
  getComposioErrorMessage,
  isComposioForbidden,
  isComposioNotReady,
  isComposioUnconfigured,
} from '@/services/composioService';
import { ComposioConnectionStatus, FEATURED_TOOLKIT_LABELS } from '@/types/composio.types';
import type { ComposioAdminConnection } from '@/types/composio.types';

const ALL_STATUSES = '__all__';

const relativeTime = (value?: string | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '—';
  }
};

const toolkitName = (connection: ComposioAdminConnection): string => {
  const slug = connection.toolkit_slug || connection.toolkit?.slug || '';
  return connection.toolkit?.name || FEATURED_TOOLKIT_LABELS[slug.toUpperCase()] || slug || 'Unknown';
};

export const ComposioConnections = () => {
  const navigate = useNavigate();
  const { useAdminConnections, revokeAdminConnection } = useComposio();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL_STATUSES);
  const [revokeTarget, setRevokeTarget] = useState<ComposioAdminConnection | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: status === ALL_STATUSES ? undefined : (status as ComposioConnectionStatus),
      page_size: 50,
    }),
    [search, status]
  );

  const { data, error, isLoading, mutate } = useAdminConnections(params);
  const connections = data?.results ?? [];

  // SWR's bound `mutate()` rejects when the fetcher throws. Without a catch that
  // becomes an unhandled promise rejection on every Try Again click while the
  // backend endpoints are still missing — the rendered `error` already tells the
  // user what happened.
  const retry = () => {
    void mutate().catch(() => undefined);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      await revokeAdminConnection(revokeTarget.public_id);
      toast.success(`${toolkitName(revokeTarget)} access revoked`);
      setRevokeTarget(null);
    } catch (err) {
      toast.error(getComposioErrorMessage(err, 'Could not revoke this connection'));
    } finally {
      setIsRevoking(false);
    }
  };

  const renderBody = () => {
    if (isLoading && !data) {
      return (
        <div className="space-y-2">
          {[...Array(5)].map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      );
    }

    if (error) {
      if (isComposioUnconfigured(error) || isComposioNotReady(error)) {
        return (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm">Connected apps aren't available yet</AlertTitle>
            <AlertDescription className="text-xs">
              {isComposioUnconfigured(error)
                ? 'Connected apps aren’t set up for this workspace yet.'
                : 'This workspace is running a build of the API that doesn’t include connected apps yet.'}
            </AlertDescription>
          </Alert>
        );
      }
      if (isComposioForbidden(error)) {
        return (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">Administrator access required</AlertTitle>
            <AlertDescription className="text-xs">
              Only workspace administrators can review everyone's connected apps.
            </AlertDescription>
          </Alert>
        );
      }
      return (
        <div className="text-center py-8">
          <p className="text-xs text-red-500">
            {getComposioErrorMessage(error, 'Failed to load workspace connections')}
          </p>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={retry}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!connections.length) {
      return (
        <div className="text-center py-8">
          <Blocks className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {search ? `No connections match "${search}"` : 'No connected apps in this workspace yet'}
          </p>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">App</TableHead>
              <TableHead className="text-xs">Account</TableHead>
              <TableHead className="text-xs">Owner</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Last used</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {connections.map((connection) => (
              <TableRow key={connection.public_id}>
                <TableCell className="text-xs font-medium">{toolkitName(connection)}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                  {connection.account_label || connection.alias || '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                  {connection.user_id || '—'}
                </TableCell>
                <TableCell>
                  <ConnectionStatusBadge status={connection.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {relativeTime(connection.last_used_at || connection.connected_at)}
                </TableCell>
                <TableCell className="text-right">
                  <PermissionGate permission="integrations.connections.delete">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-destructive hover:text-destructive"
                      onClick={() => setRevokeTarget(connection)}
                    >
                      Revoke
                    </Button>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate('/integrations?tab=apps')}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <h1 className="text-base font-semibold">Connected apps</h1>
          <span className="text-xs text-muted-foreground">{data?.count ?? 0} in this workspace</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={retry}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by app, account or user"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 text-xs w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES} className="text-xs">
              All statuses
            </SelectItem>
            {Object.values(ComposioConnectionStatus).map((value) => (
              <SelectItem key={value} value={value} className="text-xs">
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {renderBody()}

      <DisconnectConfirmDialog
        variant="revoke"
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (!open && !isRevoking) setRevokeTarget(null);
        }}
        toolkitName={revokeTarget ? toolkitName(revokeTarget) : 'this app'}
        accountLabel={revokeTarget?.account_label}
        isPending={isRevoking}
        onConfirm={() => void handleRevoke()}
      />
    </div>
  );
};

export default ComposioConnections;
