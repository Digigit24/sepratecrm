// src/components/telephony/RawRecordsTable.tsx
// Tolerant renderer for TeleCMI's "raw" list responses (breaks, callbacks).
// The doc doesn't pin these shapes, so we defensively find the array and
// render a generic table over the union of keys.
import React, { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { extractRecords } from '@/lib/telephonyFormat';

const formatCell = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const prettify = (key: string): string =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

interface RawRecordsTableProps {
  data: unknown;
  isLoading: boolean;
  error: unknown;
  emptyText?: string;
}

export const RawRecordsTable: React.FC<RawRecordsTableProps> = ({
  data,
  isLoading,
  error,
  emptyText = 'No records found.',
}) => {
  const records = useMemo(() => extractRecords(data), [data]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    records.forEach((r) => Object.keys(r).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [records]);

  if (error) {
    return <p className="text-sm text-destructive text-center py-10">Failed to load records.</p>;
  }
  if (isLoading && records.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (records.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="whitespace-nowrap">{prettify(c)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((row, i) => (
            <TableRow key={i}>
              {columns.map((c) => (
                <TableCell key={c} className="text-xs max-w-[260px] truncate" title={formatCell(row[c])}>
                  {formatCell(row[c])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default RawRecordsTable;
