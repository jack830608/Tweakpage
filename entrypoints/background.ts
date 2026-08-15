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
      if (message?.type === 'pg:download' && message.filename && message.url) {
        void browser.downloads.download({ url: message.url, filename: message.filename });
      }
    },
  );
});
