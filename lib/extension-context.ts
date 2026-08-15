import { browser } from 'wxt/browser';

// When the extension is reloaded or updated, content scripts already running in
// open tabs are orphaned: browser.runtime/browser.storage calls throw
// synchronously ("Extension context invalidated"), so a plain `.catch()` never
// gets a chance to attach. Every call outside an async function must go
// through these wrappers.

export function isExtensionAlive(): boolean {
  try {
    return browser.runtime?.id != null;
  } catch {
    return false;
  }
}

export function safeSendMessage(message: unknown): void {
  try {
    browser.runtime.sendMessage(message).catch(() => {});
  } catch {
    // context invalidated — the message has nowhere to go
  }
}

export function safeStorageSet(items: Record<string, unknown>): void {
  try {
    browser.storage.local.set(items).catch(() => {});
  } catch {
    // context invalidated — the value is only a convenience, drop it
  }
}
