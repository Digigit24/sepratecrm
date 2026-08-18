/**
 * Team directory for the calendar's left rail and the admin team modes.
 *
 * "Admin sees the team" is defined exactly as the plan specifies for v1: the
 * caller holds `crm.meetings.view: "all"` (or `admin.full_access`). We use the
 * existing `isAdminUser()` / `getPermissionScope()` helpers, which mirror the
 * backend's `is_admin_request()` / `get_queryset_for_permission()` — no new
 * role check is invented here.
 *
 * The client check only decides whether to RENDER the toggle. The server's
 * `can_view_team` from `GET /api/calendar/members/` is authoritative, and both
 * must agree before team mode is offered (fail closed on both sides).
 */

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/useAuth';
import { calendarService } from '@/services/calendarService';
import { MASTER_DATA_DEDUPE_MS } from '@/lib/swrConfig';
import {
  getPermissionScope,
  isAdminUser,
  resolvePermissionValue,
} from '@/lib/permissions';
import { fallbackColorIndex } from '@/lib/calendarColors';
import type { CalendarMember, CalendarMembersResponse } from '@/types/calendar.types';

export const useTeamMembers = (params?: {
  start?: string;
  end?: string;
  search?: string;
  enabled?: boolean;
}) => {
  const { user, hasModuleAccess } = useAuth();
  const hasCRMAccess = hasModuleAccess('crm');

  /** Client-side mirror of the backend's team-visibility rule. */
  const canViewTeamLocally = useMemo(() => {
    if (isAdminUser(user)) return true;
    const scope = getPermissionScope(
      resolvePermissionValue(user?.permissions, 'crm.meetings.view')
    );
    return scope === 'all';
  }, [user]);

  const enabled = (params?.enabled ?? true) && hasCRMAccess && canViewTeamLocally;

  const { data, error, isLoading, mutate } = useSWR<CalendarMembersResponse>(
    enabled ? ['calendar-members', params?.start, params?.end, params?.search] : null,
    () =>
      calendarService.getMembers({
        start: params?.start,
        end: params?.end,
        search: params?.search,
      }),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      // Reference data: dedupe aggressively (this proxies an upstream HTTP call).
      dedupingInterval: MASTER_DATA_DEDUPE_MS,
      keepPreviousData: true,
    }
  );

  /**
   * Ensure every member has a colour index even if the backend has not yet
   * started emitting one, and that the caller is always present and first.
   */
  const members: CalendarMember[] = useMemo(() => {
    const raw = data?.members ?? [];
    const withColors = raw.map((m) => ({
      ...m,
      color_index: typeof m.color_index === 'number' ? m.color_index : fallbackColorIndex(m.user_id),
      is_self: m.is_self ?? (!!user?.id && String(m.user_id) === String(user.id)),
    }));
    if (!withColors.some((m) => m.is_self) && user?.id) {
      withColors.unshift({
        user_id: String(user.id),
        name: user.email || 'Me',
        email: user.email,
        color_index: fallbackColorIndex(String(user.id)),
        is_self: true,
      });
    }
    return withColors.sort((a, b) => Number(!!b.is_self) - Number(!!a.is_self));
  }, [data?.members, user?.id, user?.email]);

  const colorIndexByUser = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of members) map[m.user_id] = m.color_index;
    return map;
  }, [members]);

  return {
    members,
    colorIndexByUser,
    /** Both sides must agree before team mode is offered. */
    canViewTeam: canViewTeamLocally && !!data?.can_view_team,
    canViewTeamLocally,
    selfUserId: data?.self_user_id ?? (user?.id ? String(user.id) : null),
    /** The members endpoint has not shipped yet. */
    unavailable: !!data?.unavailable,
    isLoading,
    error,
    mutate,
  };
};
