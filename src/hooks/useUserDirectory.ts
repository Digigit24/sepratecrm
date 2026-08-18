// src/hooks/useUserDirectory.ts
//
// THE single source of truth for "turn a user UUID into something a human can
// read". Every owner / assignee / reporter / created-by render site in the app
// goes through this hook (or through <UserName> / <UserAvatar>, which wrap it).
//
// WHY ONE CANONICAL KEY
// ---------------------
// The app previously had TWO competing SWR keys for the same list —
// `['users', { page_size: 100 }]` and `['users', { page: 1, page_size: 1000,
// is_active: true }]` — spread across ~15 call sites. That meant two full
// network round-trips per session that could not share a cache, plus three
// hand-rolled `nameById` Maps that all drifted. Everything now funnels into
// the parameterless key `USER_DIRECTORY_KEY`, so no call site can fork the
// cache and SWR's dedupingInterval collapses a whole page of <UserName>
// components into at most one request.
//
// See also: src/lib/swrPersist.ts (localStorage snapshot for instant cold
// paint) and src/lib/swrConfig.ts (USER_DIRECTORY_SWR_OPTIONS).

import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import {
  userService,
  UserDirectoryForbiddenError,
  type DirectoryApiUser,
} from '@/services/userService';
import { USER_DIRECTORY_SWR_OPTIONS } from '@/lib/swrConfig';

/** The one and only SWR key for the tenant user directory. */
export const USER_DIRECTORY_KEY = 'user-directory';

export const UNASSIGNED_LABEL = 'Unassigned';
export const UNKNOWN_USER_LABEL = 'Unknown user';

export interface DirectoryUser {
  id: string;
  /** Display name. Never empty, never a UUID. */
  name: string;
  email: string;
  /** 1–2 uppercase characters for avatar fallbacks. */
  initials: string;
  avatarUrl: string | null;
  isActive: boolean;
  roleNames: string[];
}

export interface UserDirectory {
  /** Active users first, then alphabetical by name. */
  users: DirectoryUser[];
  /** O(1) lookup — replaces the `results.find(...)` scans this hook removed. */
  byId: Map<string, DirectoryUser>;
  getUser: (id?: string | null) => DirectoryUser | undefined;
  /**
   * `null`/`undefined`/`''` -> `fallback` (default "Unassigned").
   * An id that is not in the directory -> "Unknown user".
   * NEVER returns the raw UUID.
   */
  getName: (id?: string | null, fallback?: string) => string;
  /** Convenience for avatar fallbacks; '?' when the id cannot be resolved. */
  getInitials: (id?: string | null) => string;
  isLoading: boolean;
  /**
   * The directory endpoint answered 403 (account lacks directory access).
   * Consumers degrade to a muted placeholder; no toast is shown.
   */
  isForbidden: boolean;
  error: unknown;
  refresh: () => Promise<unknown>;
}

/**
 * Name resolution order:
 *   full_name -> "first last" -> email -> "Unknown user"
 *
 * `full_name` is authoritative when present (the backend falls back to the
 * email server-side), but older deployments never returned the field at all,
 * which is exactly why several call sites used to render the email. The local
 * chain keeps those deployments working.
 */
export function resolveUserName(u: DirectoryApiUser): string {
  const full = (u.full_name || '').trim();
  if (full) return full;

  const composed = `${u.first_name || ''} ${u.last_name || ''}`.trim();
  if (composed) return composed;

  const email = (u.email || '').trim();
  if (email) return email;

  return UNKNOWN_USER_LABEL;
}

/** First letters of first+last name, else the email local-part, else '?'. */
export function resolveInitials(u: DirectoryApiUser): string {
  const first = (u.first_name || '').trim();
  const last = (u.last_name || '').trim();
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
  }

  const full = (u.full_name || '').trim();
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }

  const local = (u.email || '').split('@')[0];
  if (local) return local.slice(0, 2).toUpperCase();

  return '?';
}

function normalise(u: DirectoryApiUser): DirectoryUser {
  const roleNames = Array.isArray(u.roles)
    ? u.roles
        .map((r) => (typeof r === 'string' ? r : r?.name || ''))
        .filter((n): n is string => Boolean(n))
    : [];

  return {
    id: u.id,
    name: resolveUserName(u),
    email: (u.email || '').trim(),
    initials: resolveInitials(u),
    // `avatar` is the new contract; `profile_picture` is the auth-service name.
    avatarUrl: u.avatar || u.profile_picture || null,
    isActive: u.is_active !== false,
    roleNames,
  };
}

const EMPTY_USERS: DirectoryUser[] = [];

export function useUserDirectory(): UserDirectory {
  const { data, error, isLoading, mutate } = useSWR<DirectoryApiUser[]>(
    USER_DIRECTORY_KEY,
    () => userService.getUserDirectory(),
    USER_DIRECTORY_SWR_OPTIONS
  );

  const isForbidden = error instanceof UserDirectoryForbiddenError;

  const users = useMemo<DirectoryUser[]>(() => {
    if (!Array.isArray(data) || data.length === 0) return EMPTY_USERS;

    return data
      .filter((u) => u && typeof u.id === 'string' && u.id)
      .map(normalise)
      .sort((a, b) => {
        // Active users first so assignment pickers put the useful ones on top.
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [data]);

  const byId = useMemo(() => {
    const map = new Map<string, DirectoryUser>();
    users.forEach((u) => map.set(u.id, u));
    return map;
  }, [users]);

  const getUser = useCallback(
    (id?: string | null) => (id ? byId.get(id) : undefined),
    [byId]
  );

  const getName = useCallback(
    (id?: string | null, fallback: string = UNASSIGNED_LABEL) => {
      if (!id) return fallback;
      // Never leak the raw UUID into the UI — <UserName> keeps it in `title`.
      return byId.get(id)?.name ?? UNKNOWN_USER_LABEL;
    },
    [byId]
  );

  const getInitials = useCallback(
    (id?: string | null) => (id ? byId.get(id)?.initials ?? '?' : '?'),
    [byId]
  );

  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    users,
    byId,
    getUser,
    getName,
    getInitials,
    // A 403 is a terminal, expected state — not a loading state.
    isLoading: isLoading && !isForbidden,
    isForbidden,
    error: isForbidden ? undefined : error,
    refresh,
  };
}
