// src/pages/telephony/BreaksPage.tsx
import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';
import { RawRecordsTable } from '@/components/telephony/RawRecordsTable';

const DAY_MS = 24 * 60 * 60 * 1000;

/** epoch ms -> value for <input type="datetime-local"> in local time. */
const msToLocalInput = (ms: number): string => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

export const BreaksPage: React.FC = () => {
  const { useBreaks } = useTelephony();

  const [fromInput, setFromInput] = useState(() => msToLocalInput(Date.now() - DAY_MS));

  const fromDateMs = useMemo(() => {
    const t = new Date(fromInput).getTime();
    return Number.isNaN(t) ? Date.now() - DAY_MS : t;
  }, [fromInput]);

  const { data, error, isLoading, isValidating, mutate } = useBreaks({ from_date_ms: fromDateMs });

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Breaks</h1>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => mutate()} disabled={isValidating} title="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="from-date" className="text-xs">From</Label>
          <Input
            id="from-date"
            type="datetime-local"
            className="h-8 w-[220px] text-xs"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground pb-2">Defaults to the last 24 hours.</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <RawRecordsTable data={data} isLoading={isLoading} error={error} emptyText="No break records in this range." />
        </CardContent>
      </Card>
    </div>
  );
};

export default BreaksPage;
