// src/pages/telephony/CallbacksPage.tsx
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';
import { RawRecordsTable } from '@/components/telephony/RawRecordsTable';
import { extractRecords } from '@/lib/telephonyFormat';

const DAY_MS = 24 * 60 * 60 * 1000;
const LIMIT = 10; // backend caps limit at 10

const msToLocalInput = (ms: number): string => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export const CallbacksPage: React.FC = () => {
  const { useCallbacks } = useTelephony();

  const [fromInput, setFromInput] = useState(() => msToLocalInput(Date.now() - DAY_MS));
  const [toInput, setToInput] = useState(() => msToLocalInput(Date.now()));
  const [page, setPage] = useState(1);

  const fromTs = useMemo(() => {
    const t = new Date(fromInput).getTime();
    return Number.isNaN(t) ? Date.now() - DAY_MS : t;
  }, [fromInput]);
  const toTs = useMemo(() => {
    const t = new Date(toInput).getTime();
    return Number.isNaN(t) ? Date.now() : t;
  }, [toInput]);

  const { data, error, isLoading, isValidating, mutate } = useCallbacks({
    from_ts: fromTs,
    to_ts: toTs,
    page,
    limit: LIMIT,
  });

  const records = extractRecords(data);
  // The raw callbacks endpoint doesn't return a total count; infer "has next page"
  // from whether this page came back full.
  const hasNext = records.length >= LIMIT;

  const setFrom = (v: string) => { setFromInput(v); setPage(1); };
  const setTo = (v: string) => { setToInput(v); setPage(1); };

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Callbacks</h1>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => mutate()} disabled={isValidating} title="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="cb-from" className="text-xs">From</Label>
          <Input id="cb-from" type="datetime-local" className="h-8 w-[210px] text-xs" value={fromInput} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cb-to" className="text-xs">To</Label>
          <Input id="cb-to" type="datetime-local" className="h-8 w-[210px] text-xs" value={toInput} onChange={(e) => setTo(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground pb-2">Defaults to the last 24 hours. {LIMIT} per page.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <RawRecordsTable data={data} isLoading={isLoading} error={error} emptyText="No callbacks in this range." />
        </CardContent>
      </Card>

      {/* Simple prev/next: no total from the raw endpoint, so gate Next on a full page. */}
      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallbacksPage;
