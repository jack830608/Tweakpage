import { browser } from 'wxt/browser';
import { ApplierEngine } from '../lib/applier/engine';
import { watchUrlChanges } from '../lib/applier/navigation';
import { shareIdFrom } from '../lib/share/link';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    let editorLoaded = false;
    const engine = new ApplierEngine(document);
    const openEditor = async () => {
      if (!editorLoaded) {
        await import(/* @vite-ignore */ browser.runtime.getURL('/editor-main.js'));
        editorLoaded = true;
      } else {
        document.dispatchEvent(new CustomEvent('pg-editor:toggle'));
      }
    };
    engine.whenOpened(() => void openEditor().catch(() => {}));
    engine.start(location.href).catch(() => {});
    watchUrlChanges(window, (url) => {
      engine.navigate(url).catch(() => {});
    });

    // A shared link opens the editor so the offer can be shown and refused. It never
    // applies anything on its own.
    if (shareIdFrom(location.href)) {
      void import(/* @vite-ignore */ browser.runtime.getURL('/editor-main.js'));
    }

    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type !== 'pg:toggle') return;
      openEditor().catch(() => {});
    });
  },
});
