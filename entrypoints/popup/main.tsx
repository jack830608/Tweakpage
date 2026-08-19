import { browser } from 'wxt/browser';
import { createRoot } from 'react-dom/client';
import { PopupApp } from './PopupApp';

/**
 * These two pages followed the OS only, so choosing Light in the panel left a dark popup
 * and a dark settings page on a dark machine — one setting that visibly governed one of
 * three surfaces. The panel owns the choice; everything else reads it.
 */
void browser.storage.local
  .get('tweakpage:panel-prefs')
  .then((stored) => {
    const theme = (stored['tweakpage:panel-prefs'] as { theme?: string } | undefined)?.theme;
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  })
  .catch(() => {});


createRoot(document.getElementById('root')!).render(<PopupApp />);
