import { browser } from 'wxt/browser';
import { ApplierEngine } from '../lib/applier/engine';
import { watchUrlChanges } from '../lib/applier/navigation';
import { shareRefFrom } from '../lib/share/link';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_idle',
  main() {
    let editorLoaded = false;
    const engine = new ApplierEngine(document);
    // The one loader: everything that pulls the editor in goes through here, so the
    // loaded flag can't drift — a load that skipped it left the chip's click doing an
    // import that was already a no-op, and nothing else.
    const loadEditor = async () => {
      if (editorLoaded) return false;
      await import(/* @vite-ignore */ browser.runtime.getURL('/editor-main.js'));
      editorLoaded = true;
      return true;
    };
    const openEditor = async () => {
      // Loading boots the editor open; if it is already loaded, say "up", not "toggle".
      if (!(await loadEditor())) document.dispatchEvent(new CustomEvent('pg-editor:open'));
    };
    engine.whenOpened(() => void openEditor().catch(() => {}));
    engine.start(location.href).catch(() => {});
    watchUrlChanges(window, (url) => {
      engine.navigate(url).catch(() => {});
    });

    // A shared link opens the editor so the offer can be shown and refused. It never
    // applies anything on its own.
    if (shareRefFrom(location.href)) {
      void loadEditor().catch(() => {});
    }

    browser.runtime.onMessage.addListener((message: { type?: string }) => {
      if (message?.type !== 'pg:toggle') return;
      // The toolbar icon is the one control that means "toggle".
      void loadEditor()
        .then((booted) => {
          if (!booted) document.dispatchEvent(new CustomEvent('pg-editor:toggle'));
        })
        .catch(() => {});
    });
  },
});
