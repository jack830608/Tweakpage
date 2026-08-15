import { browser } from 'wxt/browser';
import { ApplierEngine } from '../lib/applier/engine';
import { watchUrlChanges } from '../lib/applier/navigation';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    const engine = new ApplierEngine(document);
    engine.start(location.href).catch(() => {});
    watchUrlChanges(window, (url) => {
      engine.navigate(url).catch(() => {});
    });

    let editorLoaded = false;
    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type !== 'pg:toggle') return;
      (async () => {
        if (!editorLoaded) {
          await import(/* @vite-ignore */ browser.runtime.getURL('/editor-main.js'));
          editorLoaded = true;
        } else {
          document.dispatchEvent(new CustomEvent('pg-editor:toggle'));
        }
      })().catch(() => {});
    });
  },
});
