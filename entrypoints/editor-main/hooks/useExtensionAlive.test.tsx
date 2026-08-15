import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useExtensionAlive } from './useExtensionAlive';

const context = vi.hoisted(() => ({ alive: true }));
vi.mock('../../../lib/extension-context', () => ({
  isExtensionAlive: () => context.alive,
}));

beforeEach(() => {
  context.alive = true;
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

test('stays true while the extension context is alive', () => {
  const { result } = renderHook(() => useExtensionAlive());
  act(() => {
    vi.advanceTimersByTime(20_000);
  });
  expect(result.current).toBe(true);
});

test('flips to false after the context is invalidated', () => {
  const { result } = renderHook(() => useExtensionAlive());
  expect(result.current).toBe(true);
  context.alive = false;
  act(() => {
    vi.advanceTimersByTime(5_000);
  });
  expect(result.current).toBe(false);
});

test('stops polling once dead', () => {
  const { result } = renderHook(() => useExtensionAlive());
  context.alive = false;
  act(() => {
    vi.advanceTimersByTime(5_000);
  });
  expect(result.current).toBe(false);
  context.alive = true; // a dead context never comes back — the flag must not either
  act(() => {
    vi.advanceTimersByTime(20_000);
  });
  expect(result.current).toBe(false);
});
