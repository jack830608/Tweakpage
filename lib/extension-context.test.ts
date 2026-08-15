import { fakeBrowser } from 'wxt/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isExtensionAlive, safeSendMessage, safeStorageSet } from './extension-context';

afterEach(() => {
  vi.restoreAllMocks();
  fakeBrowser.reset();
});

describe('isExtensionAlive', () => {
  it('is true while runtime.id is present', () => {
    expect(isExtensionAlive()).toBe(true);
  });

  it('is false once runtime.id is gone', () => {
    const original = fakeBrowser.runtime.id;
    (fakeBrowser.runtime as { id?: string }).id = undefined;
    expect(isExtensionAlive()).toBe(false);
    fakeBrowser.runtime.id = original;
  });
});

describe('safeSendMessage', () => {
  it('swallows the synchronous throw of an invalidated context', () => {
    vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    expect(() => safeSendMessage({ type: 'pg:count', count: 1 })).not.toThrow();
  });

  it('delivers the message while the context is alive', () => {
    const spy = vi.spyOn(fakeBrowser.runtime, 'sendMessage').mockResolvedValue(undefined);
    safeSendMessage({ type: 'pg:state', active: true });
    expect(spy).toHaveBeenCalledWith({ type: 'pg:state', active: true });
  });
});

describe('safeStorageSet', () => {
  it('swallows the synchronous throw of an invalidated context', () => {
    vi.spyOn(fakeBrowser.storage.local, 'set').mockImplementation(() => {
      throw new Error('Extension context invalidated.');
    });
    expect(() => safeStorageSet({ key: 1 })).not.toThrow();
  });

  it('writes the value while the context is alive', async () => {
    safeStorageSet({ probe: 'value' });
    await new Promise((r) => setTimeout(r, 0));
    expect((await fakeBrowser.storage.local.get('probe')).probe).toBe('value');
  });
});
