// src/lib/__tests__/storageGuard.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { runStorageGuard, sanitizeThemeValue } from '../storageGuard';

describe('sanitizeThemeValue', () => {
  it('accepts current values', () => {
    expect(sanitizeThemeValue('light')).toBe('light');
    expect(sanitizeThemeValue('dark')).toBe('dark');
  });

  it('normalizes casing and whitespace', () => {
    expect(sanitizeThemeValue('  DARK ')).toBe('dark');
    expect(sanitizeThemeValue('Light')).toBe('light');
  });

  it('migrates legacy JSON-quoted strings', () => {
    expect(sanitizeThemeValue('"dark"')).toBe('dark');
    expect(sanitizeThemeValue('"light"')).toBe('light');
  });

  it('migrates legacy object values', () => {
    expect(sanitizeThemeValue({ theme: 'dark' })).toBe('dark');
    expect(sanitizeThemeValue({ mode: 'dark' })).toBe('dark');
    expect(sanitizeThemeValue({ value: 'light' })).toBe('light');
    expect(sanitizeThemeValue('{"mode":"dark"}')).toBe('dark');
  });

  it('maps system to light (enableSystem is false)', () => {
    expect(sanitizeThemeValue('system')).toBe('light');
  });

  it('rejects garbage — values that would crash classList.add', () => {
    expect(sanitizeThemeValue('')).toBeNull();
    expect(sanitizeThemeValue('[object Object]')).toBeNull();
    expect(sanitizeThemeValue('undefined')).toBeNull();
    expect(sanitizeThemeValue('dark light')).toBeNull(); // token w/ space
    expect(sanitizeThemeValue(42)).toBeNull();
    expect(sanitizeThemeValue(null)).toBeNull();
    expect(sanitizeThemeValue({ foo: 'bar' })).toBeNull();
  });
});

describe('runStorageGuard — celiyo-theme', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('leaves valid values untouched', () => {
    localStorage.setItem('celiyo-theme', 'dark');
    runStorageGuard();
    expect(localStorage.getItem('celiyo-theme')).toBe('dark');
  });

  it('migrates legacy quoted value', () => {
    localStorage.setItem('celiyo-theme', '"dark"');
    runStorageGuard();
    expect(localStorage.getItem('celiyo-theme')).toBe('dark');
  });

  it('removes classList-crashing values', () => {
    localStorage.setItem('celiyo-theme', '[object Object]');
    runStorageGuard();
    expect(localStorage.getItem('celiyo-theme')).toBeNull();
  });

  it('removes empty value', () => {
    localStorage.setItem('celiyo-theme', '');
    runStorageGuard();
    expect(localStorage.getItem('celiyo-theme')).toBeNull();
  });

  it('adopts legacy theme key when current is missing', () => {
    localStorage.setItem('theme', 'dark');
    runStorageGuard();
    expect(localStorage.getItem('celiyo-theme')).toBe('dark');
    expect(localStorage.getItem('theme')).toBeNull();
  });

  it('drops legacy keys even when current exists', () => {
    localStorage.setItem('celiyo-theme', 'light');
    localStorage.setItem('vite-ui-theme', 'dark');
    runStorageGuard();
    expect(localStorage.getItem('celiyo-theme')).toBe('light');
    expect(localStorage.getItem('vite-ui-theme')).toBeNull();
  });
});

describe('runStorageGuard — celiyo_user', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('keeps a valid user object', () => {
    const user = { id: '1', email: 'a@b.c', preferences: { theme: 'dark' } };
    localStorage.setItem('celiyo_user', JSON.stringify(user));
    runStorageGuard();
    expect(JSON.parse(localStorage.getItem('celiyo_user')!)).toEqual(user);
  });

  it('removes non-JSON user', () => {
    localStorage.setItem('celiyo_user', '[object Object]');
    runStorageGuard();
    expect(localStorage.getItem('celiyo_user')).toBeNull();
  });

  it('removes JSON-valid but wrong-shape user', () => {
    localStorage.setItem('celiyo_user', '"just a string"');
    runStorageGuard();
    expect(localStorage.getItem('celiyo_user')).toBeNull();

    localStorage.setItem('celiyo_user', '[1,2,3]');
    runStorageGuard();
    expect(localStorage.getItem('celiyo_user')).toBeNull();
  });

  it('resets non-object preferences to {}', () => {
    localStorage.setItem('celiyo_user', JSON.stringify({ id: '1', preferences: 'dark' }));
    runStorageGuard();
    const user = JSON.parse(localStorage.getItem('celiyo_user')!);
    expect(user.preferences).toEqual({});
  });

  it('migrates legacy object theme preference', () => {
    localStorage.setItem(
      'celiyo_user',
      JSON.stringify({ id: '1', preferences: { theme: { mode: 'dark' } } })
    );
    runStorageGuard();
    const user = JSON.parse(localStorage.getItem('celiyo_user')!);
    expect(user.preferences.theme).toBe('dark');
  });

  it('drops unrecognizable theme preference but keeps the user', () => {
    localStorage.setItem(
      'celiyo_user',
      JSON.stringify({ id: '1', preferences: { theme: 'blue-ish', other: 1 } })
    );
    runStorageGuard();
    const user = JSON.parse(localStorage.getItem('celiyo_user')!);
    expect(user.preferences.theme).toBeUndefined();
    expect(user.preferences.other).toBe(1);
    expect(user.id).toBe('1');
  });
});

describe('runStorageGuard — caches, widths, session, legacy auth', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('wraps legacy bare-array lead status cache', () => {
    localStorage.setItem('crm_lead_statuses', JSON.stringify([{ id: 1, name: 'New' }]));
    runStorageGuard();
    const parsed = JSON.parse(localStorage.getItem('crm_lead_statuses')!);
    expect(Array.isArray(parsed.data)).toBe(true);
    expect(typeof parsed.timestamp).toBe('number');
  });

  it('removes corrupted lead status cache', () => {
    localStorage.setItem('crm_lead_statuses', '{not json');
    runStorageGuard();
    expect(localStorage.getItem('crm_lead_statuses')).toBeNull();
  });

  it('removes non-numeric drawer widths, keeps valid ones', () => {
    localStorage.setItem('lead-drawer-width', '640');
    localStorage.setItem('contact-chat-drawer-width', 'NaN');
    localStorage.setItem('sidedrawer-width-foo', '{"w":1}');
    runStorageGuard();
    expect(localStorage.getItem('lead-drawer-width')).toBe('640');
    expect(localStorage.getItem('contact-chat-drawer-width')).toBeNull();
    expect(localStorage.getItem('sidedrawer-width-foo')).toBeNull();
  });

  it('removes corrupted app-namespaced sessionStorage JSON', () => {
    sessionStorage.setItem('celiyo_temp', '{broken');
    sessionStorage.setItem('celiyo_ok', '{"a":1}');
    sessionStorage.setItem('unrelated', '{broken'); // not ours — untouched
    runStorageGuard();
    expect(sessionStorage.getItem('celiyo_temp')).toBeNull();
    expect(sessionStorage.getItem('celiyo_ok')).toBe('{"a":1}');
    expect(sessionStorage.getItem('unrelated')).toBe('{broken');
  });

  it('adopts legacy auth keys when current ones are empty, then drops them', () => {
    localStorage.setItem('accessToken', 'tok-a');
    localStorage.setItem('refreshToken', 'tok-r');
    runStorageGuard();
    expect(localStorage.getItem('celiyo_access_token')).toBe('tok-a');
    expect(localStorage.getItem('celiyo_refresh_token')).toBe('tok-r');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('sweeps garbage literals in app-namespaced keys', () => {
    localStorage.setItem('celiyo_something', 'undefined');
    localStorage.setItem('crm_thing', '[object Object]');
    runStorageGuard();
    expect(localStorage.getItem('celiyo_something')).toBeNull();
    expect(localStorage.getItem('crm_thing')).toBeNull();
  });

  it('stamps the storage version and never throws', () => {
    runStorageGuard();
    expect(localStorage.getItem('celiyo_storage_version')).toBe('2');
  });
});
