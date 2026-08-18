// src/components/composio/ToolkitCatalogue.tsx
//
// The "Apps" surface: a searchable grid of Composio toolkits with per-toolkit
// connection status. Featured toolkits (Gmail, Notion, Google Drive, Google
// Calendar) are pinned to the front so the four priority integrations are the
// first thing a user sees.
//
// Every state from plan §D.9 is implemented: skeletons, search-empty, error,
// "not configured" (424) and "not available yet" (404 — the Django side is
// being built in parallel, and this must not look like a crash).

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Blocks, Info, RefreshCw, Search } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToolkitCard } from '@/components/composio/ToolkitCard';
import { ConnectToolkitDialog } from '@/components/composio/ConnectToolkitDialog';
import { useComposio } from '@/hooks/useComposio';
import {
  getComposioErrorMessage,
  isComposioForbidden,
  isComposioNotReady,
  isComposioUnconfigured,
} from '@/services/composioService';
import { isFeaturedToolkit } from '@/types/composio.types';
import type { ComposioToolkit } from '@/types/composio.types';

const ALL_CATEGORIES = '__all__';

interface ToolkitCatalogueProps {
  /** Called when the user asks to manage an already-connected toolkit. */
  onManageConnection?: (toolkit: ComposioToolkit) => void;
}

export const ToolkitCatalogue = ({ onManageConnection }: ToolkitCatalogueProps) => {
  const { useToolkits } = useComposio();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [dialogToolkit, setDialogToolkit] = useState<ComposioToolkit | null>(null);

  // Debounce so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo(
    () => ({
      search: search || undefined,
      category: category === ALL_CATEGORIES ? undefined : category,
      page_size: 60,
    }),
    [search, category]
  );

  const { data, error, isLoading, mutate } = useToolkits(params);

  // Memoised so the `??` fallback does not hand a fresh [] to the useMemos below.
  const toolkits = useMemo(() => data?.results ?? [], [data]);

  // SWR's bound `mutate()` rejects when the fetcher throws. Without a catch that
  // becomes an unhandled promise rejection on every Try Again click while the
  // backend endpoints are still missing — the rendered `error` already tells the
  // user what happened.
  const retry = () => {
    void mutate().catch(() => undefined);
  };

  // Featured first, then alphabetical — the four priority toolkits lead.
  const sorted = useMemo(() => {
    return [...toolkits].sort((a, b) => {
      const featuredDelta = Number(isFeaturedToolkit(b)) - Number(isFeaturedToolkit(a));
      if (featuredDelta !== 0) return featuredDelta;
      return (a.name || a.slug || '').localeCompare(b.name || b.slug || '');
    });
  }, [toolkits]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    toolkits.forEach((toolkit) => (toolkit.categories ?? []).forEach((c) => c && set.add(c)));
    return Array.from(set).sort();
  }, [toolkits]);

  const handleConnect = (toolkit: ComposioToolkit) => setDialogToolkit(toolkit);

  const handleManage = (toolkit: ComposioToolkit) => {
    if (onManageConnection) onManageConnection(toolkit);
    else setDialogToolkit(toolkit);
  };

  const renderContent = () => {
    if (isLoading && !data) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {[...Array(8)].map((_, index) => (
            <div key={index} className="border rounded-lg p-3">
              <Skeleton className="h-8 w-8 rounded mb-3" />
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-2/3 mb-3" />
              <Skeleton className="h-7 w-full" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      // 424 — Composio is not wired up for this workspace. Not an error state.
      if (isComposioUnconfigured(error)) {
        return (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm">Connected apps aren't set up yet</AlertTitle>
            <AlertDescription className="text-xs">
              Connected apps aren't set up for this workspace yet. Ask an administrator to configure
              Composio.
            </AlertDescription>
          </Alert>
        );
      }

      // 404 / 501 — the endpoints are not deployed on this backend build.
      if (isComposioNotReady(error)) {
        return (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle className="text-sm">Connected apps aren't available yet</AlertTitle>
            <AlertDescription className="text-xs">
              This workspace is running a build of the API that doesn't include connected apps. Nothing
              is broken — check back once it has been updated.
            </AlertDescription>
          </Alert>
        );
      }

      if (isComposioForbidden(error)) {
        return (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-sm">You don't have access to connected apps</AlertTitle>
            <AlertDescription className="text-xs">
              Ask a workspace administrator to grant you the "integrations" permissions.
            </AlertDescription>
          </Alert>
        );
      }

      return (
        <div className="text-center py-8">
          <p className="text-xs text-red-500">
            {getComposioErrorMessage(error, 'Failed to load apps')}
          </p>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={retry}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!sorted.length) {
      return (
        <div className="text-center py-8">
          <Blocks className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">
            {search ? `No apps match "${search}"` : 'No apps available'}
          </p>
          {search && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 text-xs"
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
            >
              Clear search
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {sorted.map((toolkit) => (
          <ToolkitCard
            key={toolkit.slug}
            toolkit={toolkit}
            onConnect={handleConnect}
            onManage={handleManage}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search apps — Gmail, Notion, Google Drive…"
            className="h-8 pl-7 text-xs"
          />
        </div>
        {categories.length > 0 && (
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 text-xs w-full sm:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES} className="text-xs">
                All categories
              </SelectItem>
              {categories.map((item) => (
                <SelectItem key={item} value={item} className="text-xs">
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={retry}
          title="Refresh apps"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {renderContent()}

      <ConnectToolkitDialog
        toolkit={dialogToolkit}
        open={!!dialogToolkit}
        onOpenChange={(open) => {
          if (!open) setDialogToolkit(null);
        }}
      />
    </div>
  );
};

export default ToolkitCatalogue;
