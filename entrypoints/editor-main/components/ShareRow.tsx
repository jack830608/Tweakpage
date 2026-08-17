import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { safeSendMessage } from '../../../lib/extension-context';
import { makeShareId, shareLink } from '../../../lib/share/link';
import { getShareSettings, isConfigured } from '../../../lib/share/settings';
import { toCss } from '../../../lib/export/css';
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { CameraIcon, CopyIcon, DownloadIcon, LinkIcon } from './icons';
import { t } from '../../../lib/i18n';

interface ShareRowProps {
  controller: EditsController;
  onToast: (toast: ToastContent) => void;
  onSnapshot: () => void;
}

export function ShareRow({ controller, onToast, onSnapshot }: ShareRowProps) {
  const today = () => new Date().toISOString().slice(0, 10);
  // Offering a button that can only fail is worse than not offering it.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    void getShareSettings().then((settings) => setCanShare(isConfigured(settings)));
  }, []);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast({ message });
    } catch {
      window.prompt('Copy the text below:', text);
    }
  };

  const onShareLink = async () => {
    const page = controller.getPage();
    const id = makeShareId();
    const result = (await browser.runtime
      .sendMessage({ type: 'pg:share-put', id, body: toJson(page) })
      .catch(() => null)) as { ok?: boolean; ref?: Parameters<typeof shareLink>[1] } | null;

    if (!result?.ok || !result.ref) {
      onToast({ message: t('toast_share_failed') });
      return;
    }
    await copy(shareLink(page.url, result.ref), t('toast_share_copied'));
  };

  const onJsonFile = () => {
    const page = controller.getPage();
    downloadFile(exportFilename(page.url, today().replaceAll('-', '')), toJson(page));
    onToast({ message: t('toast_exported') });
  };

  return (
    <div className="pgve-share">
      <span className="pgve-share-label">{t('share')}</span>
      <div className="pgve-share-buttons">
        <button
          type="button"
          aria-label={t('aria_copy_summary')} data-testid="copy-summary"
          title={t('tip_copy_summary')}
          onClick={() => void copy(toMarkdown(controller.getPage(), today()), t('toast_copied'))}
        >
          <CopyIcon /> {t('share_summary')}
        </button>
        <button
          type="button"
          aria-label={t('aria_copy_css')} data-testid="copy-css"
          title={t('tip_copy_css')}
          onClick={() => void copy(toCss(controller.getPage(), today()), t('toast_copied_css'))}
        >
          <CopyIcon /> {t('share_css')}
        </button>
        <button
          type="button"
          aria-label={t('aria_snapshot')} data-testid="snapshot-before-and-after"
          title={t('tip_snap')}
          onClick={onSnapshot}
        >
          <CameraIcon /> {t('share_snap')}
        </button>

        <button
          type="button"
          aria-label={t('aria_copy_json')} data-testid="copy-json"
          title={t('tip_copy_json')}
          onClick={() => void copy(toJson(controller.getPage()), t('toast_copied_json'))}
        >
          <CopyIcon /> {t('share_json')}
        </button>
        <button type="button" aria-label={t('aria_export_json')} data-testid="export-json" title={t('tip_export')} onClick={onJsonFile}>
          <DownloadIcon /> {t('share_download')}
        </button>
        <button
          type="button"
          aria-label={t('aria_share_link')}
          data-testid="share-link"
          disabled={!canShare}
          title={canShare ? t('tip_share_link') : t('tip_share_unset')}
          onClick={() => void onShareLink()}
        >
          <LinkIcon /> {t('share_link')}
        </button>
      </div>
    </div>
  );
}

// A blob: URL created here would be scoped to this content script's isolated world and
// can't be resolved by Chrome's download machinery, so hand the content to the background
// service worker (which has chrome.downloads access) as a data: URL instead.
function downloadFile(filename: string, content: string): void {
  const url = `data:application/json;base64,${toBase64(content)}`;
  safeSendMessage({ type: 'pg:download', filename, url });
}

function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
