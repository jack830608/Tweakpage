import { browser } from 'wxt/browser';
import { getShared, putShared } from '../lib/share/transfer';

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
        ref?: { id: string; bucket: string; region: string };
      },
      sender,
    ) => {
      if (message?.type === 'pg:state' && sender.tab?.id != null) {
        void browser.action.setBadgeBackgroundColor({
          tabId: sender.tab.id,
          color: message.active ? '#059669' : '#71717a',
        });
      }
      if (message?.type === 'pg:count' && typeof message.count === 'number' && sender.tab?.id != null) {
        void browser.action.setBadgeText({
          tabId: sender.tab.id,
          text: message.count > 0 ? String(message.count) : '',
        });
        void browser.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#71717a' });
      }
      if (message?.type === 'pg:capture' && typeof message.filename === 'string' && sender.tab?.windowId != null) {
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
      if (message?.type === 'pg:share-put' && typeof message.id === 'string' && typeof message.body === 'string') {
        return putShared(message.id, message.body);
      }
      if (message?.type === 'pg:share-get' && message.ref) {
        return getShared(message.ref);
      }
      if (message?.type === 'pg:grab' && sender.tab?.windowId != null) {
        return browser.tabs
          .captureVisibleTab(sender.tab.windowId, { format: 'png' })
          .catch((error: unknown) => {
            console.warn('[tweakpage] capture failed', error);
            return undefined;
          });
      }
      if (message?.type === 'pg:save-png' && typeof message.url === 'string' && typeof message.filename === 'string') {
        if (!message.url.startsWith('data:image/png;base64,')) return;
        if (!/^tweakpage-[\w.-]+\.png$/.test(message.filename)) return;
        browser.downloads.download({ url: message.url, filename: message.filename }).catch((error: unknown) => {
          console.warn('[tweakpage] download failed', error);
        });
      }
      if (message?.type === 'pg:download' && typeof message.url === 'string' && typeof message.filename === 'string') {
        if (!message.url.startsWith('data:application/json;base64,')) return;
        if (!/^tweakpage-[\w.-]+\.json$/.test(message.filename)) return;
        browser.downloads.download({ url: message.url, filename: message.filename }).catch((error: unknown) => {
          console.warn('[tweakpage] download failed', error);
        });
      }
    },
  );
});
