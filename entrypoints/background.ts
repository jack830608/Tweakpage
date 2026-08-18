import { browser } from 'wxt/browser';
import { getShared, putShared } from '../lib/share/transfer';
import type { PageEdits } from '../lib/edits/types';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(
    (
      message: {
        type?: string;
        active?: boolean;
        count?: number;
        filename?: string;
        url?: string;
        id?: string;
        body?: string;
        page?: unknown;
        ref?: { id: string; bucket: string; region: string };
      },
      sender,
    ) => {
      if (message?.type === 'tweakpage:state' && sender.tab?.id != null) {
        void browser.action.setBadgeBackgroundColor({
          tabId: sender.tab.id,
          color: message.active ? '#059669' : '#71717a',
        });
      }
      if (message?.type === 'tweakpage:count' && typeof message.count === 'number' && sender.tab?.id != null) {
        void browser.action.setBadgeText({
          tabId: sender.tab.id,
          text: message.count > 0 ? String(message.count) : '',
        });
        void browser.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#71717a' });
      }
      if (message?.type === 'tweakpage:capture' && typeof message.filename === 'string' && sender.tab?.windowId != null) {
        if (!/^tweakpage-[\w.-]+\.png$/.test(message.filename)) return;
        return browser.tabs
          .captureVisibleTab(sender.tab.windowId, { format: 'png' })
          .then((dataUrl) => browser.downloads.download({ url: dataUrl, filename: message.filename! }))
          .then(() => undefined)
          .catch((error: unknown) => {
            console.warn('[tweakpage] capture failed', error);
          });
      }
      // Hands the pixels back instead of downloading them, so the editor can put the
      // two captures side by side before anything reaches the downloads folder.
      if (message?.type === 'tweakpage:share-put' && typeof message.id === 'string' && message.page) {
        return putShared(message.id, message.page as PageEdits);
      }
      if (message?.type === 'tweakpage:open-options') {
        void browser.runtime.openOptionsPage();
      }
      if (message?.type === 'tweakpage:share-get' && message.ref) {
        return getShared(message.ref);
      }
      if (message?.type === 'tweakpage:grab' && sender.tab?.windowId != null) {
        return browser.tabs
          .captureVisibleTab(sender.tab.windowId, { format: 'png' })
          .catch((error: unknown) => {
            console.warn('[tweakpage] capture failed', error);
            return undefined;
          });
      }
      if (message?.type === 'tweakpage:save-png' && typeof message.url === 'string' && typeof message.filename === 'string') {
        if (!message.url.startsWith('data:image/png;base64,')) return;
        if (!/^tweakpage-[\w.-]+\.png$/.test(message.filename)) return;
        browser.downloads.download({ url: message.url, filename: message.filename }).catch((error: unknown) => {
          console.warn('[tweakpage] download failed', error);
        });
      }
      if (message?.type === 'tweakpage:download' && typeof message.url === 'string' && typeof message.filename === 'string') {
        if (!message.url.startsWith('data:application/json;base64,')) return;
        if (!/^tweakpage-[\w.-]+\.json$/.test(message.filename)) return;
        browser.downloads.download({ url: message.url, filename: message.filename }).catch((error: unknown) => {
          console.warn('[tweakpage] download failed', error);
        });
      }
    },
  );
});
