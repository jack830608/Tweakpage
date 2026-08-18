import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { safeSendMessage } from '../../../lib/extension-context';
import { makeShareId, shareLink } from '../../../lib/share/link';
import { getShareSettings, isConfigured, watchShareSettings } from '../../../lib/share/settings';
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { AsyncButton } from './AsyncButton';
import { CameraIcon, CopyIcon, DownloadIcon, LinkIcon } from './icons';
import { t } from '../../../lib/i18n';

interface ShareRowProps {
  controller: EditsController;
  onToast: (toast: ToastContent) => void;
  /** Resolves when the captures are composed and saved; false on failure. */
  onSnapshot: () => Promise<boolean>;
}

export function ShareRow({ controller, onToast, onSnapshot }: ShareRowProps) {
  const today = () => new Date().toISOString().slice(0, 10);
  // Offering a button that can only fail is worse than not offering it.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    const read = (settings: Parameters<typeof isConfigured>[0]) => setCanShare(isConfigured(settings));
    void getShareSettings().then(read);
    return watchShareSettings(read);
  }, []);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast({ message, kind: 'success' });
    } catch {
      window.prompt('Copy the text below:', text);
    }
  };

  const onShareLink = async () => {
    const page = controller.getPage();
    const id = makeShareId();
    const result = (await browser.runtime
      .sendMessage({ type: 'tweakpage:share-put', id, page })
      .catch(() => null)) as
      | {
          ok?: boolean;
          reason?: string;
          ref?: Parameters<typeof shareLink>[1];
          images?: { uploaded: number; compressed: number; embedded: number };
        }
      | null;

    if (!result?.ok || !result.ref) {
      // A link nobody can open is the failure worth naming precisely.
      onToast({
        message: t(result?.reason === 'not-readable' ? 'toast_share_private' : 'toast_share_failed'),
        kind: 'error',
      });
      return false;
    }
    await copy(shareLink(page.url, result.ref), shareMessage(result.images));
    return true;
  };

  /**
   * The link is copied either way; what changes is what the reader will actually see.
   * An image that had to travel embedded will be dropped on arrival, and saying so here
   * is the only chance to say it.
   */
  const shareMessage = (images?: { uploaded: number; compressed: number; embedded: number }) => {
    if (!images || (images.uploaded === 0 && images.embedded === 0)) return t('toast_share_copied');
    if (images.embedded > 0) return t('toast_share_copied_without_images', [images.embedded]);
    return images.compressed > 0
      ? t('toast_share_copied_images_compressed', [images.uploaded, images.compressed])
      : t('toast_share_copied_images', [images.uploaded]);
  };

  const onJsonFile = () => {
    const page = controller.getPage();
    downloadFile(exportFilename(page.url, today().replaceAll('-', '')), toJson(page));
    onToast({ message: t('toast_exported'), kind: 'success' });
  };

  return (
    <div className="twk-share">
      <span className="twk-share-label">{t('share')}</span>
      <div className="twk-share-buttons">
        <button
          type="button"
          aria-label={t('aria_copy_summary')} data-testid="copy-summary"
          title={t('tip_copy_summary')}
          onClick={() => void copy(toMarkdown(controller.getPage(), today()), t('toast_copied'))}
        >
          <CopyIcon /> {t('share_summary')}
        </button>
        <AsyncButton
          icon={<CameraIcon />}
          label={t('share_snap')}
          busyLabel={t('snap_busy')}
          doneLabel={t('snap_done')}
          ariaLabel={t('aria_snapshot')}
          testId="snapshot-before-and-after"
          title={t('tip_snap')}
          run={onSnapshot}
        />

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
        <AsyncButton
          icon={<LinkIcon />}
          label={t('share_link')}
          busyLabel={t('share_link_busy')}
          doneLabel={t('share_link_done')}
          ariaLabel={t('aria_share_link')}
          testId="share-link"
          disabled={!canShare}
          title={canShare ? t('tip_share_link') : t('tip_share_unset')}
          run={onShareLink}
        />
      </div>
    </div>
  );
}

// A blob: URL created here would be scoped to this content script's isolated world and
// can't be resolved by Chrome's download machinery, so hand the content to the background
// service worker (which has chrome.downloads access) as a data: URL instead.
function downloadFile(filename: string, content: string): void {
  const url = `data:application/json;base64,${toBase64(content)}`;
  safeSendMessage({ type: 'tweakpage:download', filename, url });
}

function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
