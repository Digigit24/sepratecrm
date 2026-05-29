// src/lib/telephonyFormat.ts
// Shared formatting helpers for telephony call/SMS views.
import { formatDistanceToNow, format } from 'date-fns';
import { CallType } from '@/types/telephony.types';

/** Call duration as `m:ss`, or "Missed" for a missed / zero-length call. */
export const formatDuration = (seconds: number, callType?: CallType): string => {
  if (callType === CallType.MISSED || !seconds || seconds <= 0) return 'Missed';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** ISO timestamp -> "2 hours ago" (safe against bad input). */
export const safeRelative = (iso?: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDistanceToNow(d, { addSuffix: true });
};

/** ISO timestamp -> full readable date/time for tooltips. */
export const safeExact = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'PPpp');
};

/** Epoch-ms timestamp -> readable date/time (TeleCMI notes use ms). */
export const msToExact = (ms?: number): string => {
  if (!ms) return '';
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'PPp');
};

/** Pull an array of records out of an unknown TeleCMI payload (raw endpoints). */
export const extractRecords = (data: unknown): Record<string, unknown>[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['results', 'data', 'callbacks', 'breaks', 'records', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as Record<string, unknown>[];
    }
  }
  return [];
};
