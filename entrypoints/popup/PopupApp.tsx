import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import type { PageEdits } from '../../lib/edits/types';
import { t } from '../../lib/i18n';

interface PageEntry {
  key: string;
  page: PageEdits;
}

export function PopupApp() {
  const [entries, setEntries] = useState<PageEntry[]>([]);

  const load = async () => {
    try {
      const all = await browser.storage.local.get(null);
      const pages = Object.entries(all)
        .filter(([key]) => key.startsWith('page:'))
        .map(([key, value]) => ({ key, page: value as PageEdits }))
        .filter((entry) => Array.isArray(entry.page.records) && entry.page.records.length > 0)
        .sort((a, b) => (b.page.updatedAt || '').localeCompare(a.page.updatedAt || ''));
      setEntries(pages);
    } catch {
      setEntries([]);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onEditThisPage = async () => {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab?.id != null) await browser.tabs.sendMessage(tab.id, { type: 'pg:toggle' });
      window.close();
    } catch {
      // Pages without the content script (chrome://, web store) can't be edited.
    }
  };

  const onOpen = (url: string) => {
    void browser.tabs.create({ url });
    window.close();
  };

  const onClear = async (key: string) => {
    await browser.storage.local.remove(key);
    void load();
  };

  return (
    <div className="pop">
      <header className="pop-header">
        <strong>Tweakpage</strong>
      </header>
      <button type="button" className="pop-primary" onClick={() => void onEditThisPage()}>
        {t('pop_edit_this_page')}
      </button>
      <div className="pop-section-title">{t('pop_pages')}</div>
      {entries.length === 0 ? (
        <p className="pop-empty">{t('pop_empty')}</p>
      ) : (
        <ul className="pop-list">
          {entries.map(({ key, page }) => (
            <li key={key}>
              <div className="pop-page">
                <div className="pop-page-title">{page.title || new URL(page.url).hostname}</div>
                <div className="pop-page-url">{page.url.replace(/^https?:\/\//, '')}</div>
              </div>
              <span className="pop-count">{page.records.length}</span>
              <button type="button" aria-label={`Open ${page.url}`} onClick={() => onOpen(page.url)}>
                {t('pop_open')}
              </button>
              <button type="button" aria-label={`Clear edits for ${page.url}`} onClick={() => void onClear(key)}>
                {t('pop_clear')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
