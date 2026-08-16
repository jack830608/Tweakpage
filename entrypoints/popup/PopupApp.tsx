import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { pageKey } from '../../lib/edits/storage';
import type { PageEdits } from '../../lib/edits/types';
import { ConfirmButton } from '../editor-main/components/ConfirmButton';
import { t } from '../../lib/i18n';

interface PageEntry {
  key: string;
  page: PageEdits;
}

function keyForUrl(url: string | undefined): string | null {
  if (!url || !/^https?:/.test(url)) return null;
  try {
    return pageKey(url);
  } catch {
    return null;
  }
}

type Blocked = 'unsupported-page' | 'needs-reload' | null;

export function PopupApp() {
  const [entries, setEntries] = useState<PageEntry[]>([]);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<Blocked>(null);

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
    void browser.tabs
      .query({ active: true, currentWindow: true })
      .then(([tab]) => setCurrentKey(keyForUrl(tab?.url)))
      .catch(() => setCurrentKey(null));
  }, []);

  const onEditThisPage = async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    // chrome://, the Web Store and other browser-owned pages refuse content scripts.
    if (!tab?.url || !/^https?:/.test(tab.url)) {
      setBlocked('unsupported-page');
      return;
    }
    try {
      if (tab.id != null) await browser.tabs.sendMessage(tab.id, { type: 'pg:toggle' });
      window.close();
    } catch {
      // The page was open before the extension was installed or updated, so nothing is
      // listening in it yet.
      setBlocked('needs-reload');
    }
  };

  // Opening a page that is already on screen used to spawn a duplicate tab every
  // time — and the popup looked identical afterwards, so it invited another click.
  const onOpen = async (url: string) => {
    const wanted = keyForUrl(url);
    try {
      const open = await browser.tabs.query({});
      const match = open.find((tab) => keyForUrl(tab.url) === wanted);
      if (match?.id != null) {
        await browser.tabs.update(match.id, { active: true });
        if (match.windowId != null) await browser.windows.update(match.windowId, { focused: true });
      } else {
        await browser.tabs.create({ url });
      }
    } catch {
      await browser.tabs.create({ url }).catch(() => {});
    }
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
      {blocked && (
        <p className="pop-blocked" role="alert" data-testid="blocked-reason">
          {t(blocked === 'unsupported-page' ? 'pop_unsupported' : 'pop_needs_reload')}
        </p>
      )}
      <div className="pop-section-title">{t('pop_pages')}</div>
      {entries.length === 0 ? (
        <p className="pop-empty">{t('pop_empty')}</p>
      ) : (
        <ul className="pop-list">
          {entries.map(({ key, page }) => {
            const current = key === currentKey;
            return (
              <li key={key} className={current ? 'pop-current' : undefined}>
                <div className="pop-page">
                  <div className="pop-page-title">{page.title || new URL(page.url).hostname}</div>
                  {current ? (
                    <div className="pop-page-here">{t('pop_applied_here')}</div>
                  ) : (
                    <div className="pop-page-url">{page.url.replace(/^https?:\/\//, '')}</div>
                  )}
                </div>
                <span className="pop-count">{page.records.length}</span>
                {current ? (
                  <button
                    type="button"
                    aria-label={`Edit ${page.url}`}
                    onClick={() => void onEditThisPage()}
                  >
                    {t('pop_edit')}
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Open ${page.url}`}
                    onClick={() => void onOpen(page.url)}
                  >
                    {t('pop_open')}
                  </button>
                )}
                <ConfirmButton
                  label={t('pop_clear')}
                  ariaLabel={`Clear edits for ${page.url}`}
                  onConfirm={() => void onClear(key)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
