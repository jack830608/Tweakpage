import { browser } from 'wxt/browser';

export default defineBackground(() => {
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    browser.tabs.sendMessage(tab.id, { type: 'pg:toggle' }).catch(() => {
      // No content script on this page (chrome://, web store, etc.) — nothing to do.
    });
  });

  browser.runtime.onMessage.addListener(
    (message: { type?: string; active?: boolean; filename?: string; url?: string }, sender) => {
      if (message?.type === 'pg:state' && sender.tab?.id != null) {
        void browser.action.setBadgeText({ tabId: sender.tab.id, text: message.active ? 'ON' : '' });
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
