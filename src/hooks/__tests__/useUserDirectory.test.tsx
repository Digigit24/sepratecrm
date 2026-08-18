// src/hooks/__tests__/useUserDirectory.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { SWRConfig } from 'swr';

// The hook only ever touches userService.getUserDirectory(); mocking it keeps
// the test focused on normalisation + the edge cases the UI depends on.
const mocks = vi.hoisted(() => {
  class ForbiddenErrorStub extends Error {
    readonly isForbidden = true;
    constructor(message = 'forbidden') {
      super(message);
      this.name = 'UserDirectoryForbiddenError';
    }
  }
  return {
    ForbiddenErrorStub,
    getUserDirectory: vi.fn(),
  };
});

vi.mock('@/services/userService', () => ({
  UserDirectoryForbiddenError: mocks.ForbiddenErrorStub,
  userService: { getUserDirectory: mocks.getUserDirectory },
}));

import { userService } from '@/services/userService';
import { useUserDirectory } from '@/hooks/useUserDirectory';

const getUserDirectory = userService.getUserDirectory as ReturnType<typeof vi.fn>;

// Fresh, isolated SWR cache per test so keys never leak between cases.
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    {children}
  </SWRConfig>
);

const render = () => renderHook(() => useUserDirectory(), { wrapper });

beforeEach(() => {
  getUserDirectory.mockReset();
});

describe('useUserDirectory', () => {
  it('prefers full_name, then first+last, then email', async () => {
    getUserDirectory.mockResolvedValue([
      { id: 'a', full_name: 'Asha Rao', first_name: 'Asha', last_name: 'Rao', email: 'asha@x.com' },
      { id: 'b', first_name: 'Bo', last_name: 'Li', email: 'bo@x.com' },
      { id: 'c', email: 'ceo@x.com' },
    ]);

    const { result } = render();
    await waitFor(() => expect(result.current.users).toHaveLength(3));

    expect(result.current.getName('a')).toBe('Asha Rao');
    expect(result.current.getName('b')).toBe('Bo Li');
    expect(result.current.getName('c')).toBe('ceo@x.com');
  });

  it('returns "Unassigned" for null/undefined/empty and honours an override', async () => {
    getUserDirectory.mockResolvedValue([]);
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getName(null)).toBe('Unassigned');
    expect(result.current.getName(undefined)).toBe('Unassigned');
    expect(result.current.getName('')).toBe('Unassigned');
    expect(result.current.getName(null, '—')).toBe('—');
  });

  it('never returns the raw UUID for an unknown id', async () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    getUserDirectory.mockResolvedValue([{ id: 'a', full_name: 'Asha Rao', email: 'a@x.com' }]);

    const { result } = render();
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    expect(result.current.getName(uuid)).toBe('Unknown user');
    expect(result.current.getName(uuid)).not.toContain(uuid);
    expect(result.current.getUser(uuid)).toBeUndefined();
  });

  it('sets isForbidden with an empty map on 403 and suppresses the error', async () => {
    getUserDirectory.mockRejectedValue(new mocks.ForbiddenErrorStub());

    const { result } = render();
    await waitFor(() => expect(result.current.isForbidden).toBe(true));

    expect(result.current.users).toHaveLength(0);
    expect(result.current.byId.size).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.getName('anything')).toBe('Unknown user');
  });

  it('derives initials, including for a user with no names', async () => {
    getUserDirectory.mockResolvedValue([
      { id: 'a', first_name: 'Asha', last_name: 'Rao', email: 'asha@x.com' },
      { id: 'b', email: 'nonames@x.com' },
      { id: 'c', full_name: 'Solo' },
    ]);

    const { result } = render();
    await waitFor(() => expect(result.current.users).toHaveLength(3));

    expect(result.current.getUser('a')?.initials).toBe('AR');
    expect(result.current.getUser('b')?.initials).toBe('NO');
    expect(result.current.getUser('c')?.initials).toBe('SO');
    expect(result.current.getInitials('missing')).toBe('?');
  });

  it('sorts active users first, then alphabetically, and maps avatar fields', async () => {
    getUserDirectory.mockResolvedValue([
      { id: 'z', full_name: 'Zoe', is_active: true, avatar: 'https://cdn/z.png' },
      { id: 'i', full_name: 'Anna', is_active: false, profile_picture: 'https://cdn/i.png' },
      { id: 'm', full_name: 'Mia', is_active: true },
    ]);

    const { result } = render();
    await waitFor(() => expect(result.current.users).toHaveLength(3));

    expect(result.current.users.map((u) => u.id)).toEqual(['m', 'z', 'i']);
    expect(result.current.getUser('z')?.avatarUrl).toBe('https://cdn/z.png');
    // profile_picture is the auth-service spelling of the same thing.
    expect(result.current.getUser('i')?.avatarUrl).toBe('https://cdn/i.png');
    expect(result.current.getUser('m')?.avatarUrl).toBeNull();
  });

  it('issues ONE request for many consumers of the same key', async () => {
    getUserDirectory.mockResolvedValue([{ id: 'a', full_name: 'Asha Rao' }]);

    const { result } = renderHook(
      () => [useUserDirectory(), useUserDirectory(), useUserDirectory()],
      { wrapper }
    );
    await waitFor(() => expect(result.current[0].users).toHaveLength(1));

    expect(getUserDirectory).toHaveBeenCalledTimes(1);
  });
});
