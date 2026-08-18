import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { safeSendMessage } from '../../../lib/extension-context';
import { makeShareId, shareLink } from '../../../lib/share/link';
import { getShareSettings, isConfigured, watchShareSettings } from '../../../lib/share/settings';
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';
import type { PageEdits } from '../../../lib/edits/types';
import type { ImageReport } from '../../../lib/share/transfer';
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

  // A share of nothing is a link the recipient is written to reject.
  const hasEdits = controller.getPage().records.some((r) => r.enabled);

  const copy = async (text: string, message: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onToast({ message, kind: 'success' });
    } catch {
      window.prompt('Copy the text below:', text);
    }
  };

  /**
   * The page as this hand-off should carry it.
   *
   * Uploading is per destination and per whether a bucket is configured; the worker
   * answers both. A failure here is never fatal — the page goes as it is, and the
   * message says the images stayed embedded.
   */
  const prepare = async (handOff: 'summary' | 'json' | 'download') => {
    const page = controller.getPage();
    const result = (await browser.runtime
      .sendMessage({ type: 'tweakpage:host-images', page, handOff })
      .catch(() => null)) as { page?: PageEdits; report?: ImageReport } | null;
    // An image that now has an address does not need its bytes kept here as well.
    if (result?.page) controller.adoptHostedImages(result.page.records);
    return { page: result?.page ?? page, report: result?.report };
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
          page?: PageEdits;
        }
      | null;

    if (result?.page) controller.adoptHostedImages(result.page.records);
    if (!result?.ok || !result.ref) {
      // A link nobody can open is the failure worth naming precisely.
      const REASONS: Record<string, string> = {
        'not-readable': 'toast_share_private',
        empty: 'toast_share_empty',
        'too-large': 'toast_share_too_large',
      };
      onToast({
        message: t(REASONS[result?.reason ?? ''] ?? 'toast_share_failed'),
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
  /** Adds what happened to the images, but only when there were any. */
  const imageMessage = (base: string, report?: ImageReport) => {
    if (!report || (report.uploaded === 0 && report.embedded === 0)) return base;
    if (report.uploaded > 0) return t('toast_with_images', [base, report.uploaded]);
    return t('toast_with_embedded_images', [base, report.embedded]);
  };

  const shareMessage = (images?: { uploaded: number; compressed: number; embedded: number }) => {
    if (!images || (images.uploaded === 0 && images.embedded === 0)) return t('toast_share_copied');
    if (images.embedded > 0) return t('toast_share_copied_without_images', [images.embedded]);
    return images.compressed > 0
      ? t('toast_share_copied_images_compressed', [images.uploaded, images.compressed])
      : t('toast_share_copied_images', [images.uploaded]);
  };

  const onJsonFile = async () => {
    const { page, report } = await prepare('download');
    downloadFile(exportFilename(page.url, today().replaceAll('-', '')), toJson(page));
    onToast({ message: imageMessage(t('toast_exported'), report), kind: 'success' });
  };

  return (
    <div className="twk-share">
      <span className="twk-share-label">{t('share')}</span>
      <div className="twk-share-buttons">
        <AsyncButton
          icon={<CopyIcon />}
          label={t('share_summary')}
          busyLabel={t('preparing')}
          doneLabel={t('copied')}
          ariaLabel={t('aria_copy_summary')}
          testId="copy-summary"
          title={t('tip_copy_summary')}
          run={async () => {
            const { page, report } = await prepare('summary');
            await copy(toMarkdown(page, today()), imageMessage(t('toast_copied'), report));
          }}
        />
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

        <AsyncButton
          icon={<CopyIcon />}
          label={t('share_json')}
          busyLabel={t('preparing')}
          doneLabel={t('copied')}
          ariaLabel={t('aria_copy_json')}
          testId="copy-json"
          title={t('tip_copy_json')}
          run={async () => {
            const { page, report } = await prepare('json');
            await copy(toJson(page), imageMessage(t('toast_copied_json'), report));
          }}
        />
        <AsyncButton
          icon={<DownloadIcon />}
          label={t('share_download')}
          busyLabel={t('preparing')}
          doneLabel={t('snap_done')}
          ariaLabel={t('aria_export_json')}
          testId="export-json"
          title={t('tip_export')}
          run={onJsonFile}
        />
        <AsyncButton
          icon={<LinkIcon />}
          label={t('share_link')}
          busyLabel={t('share_link_busy')}
          doneLabel={t('share_link_done')}
          ariaLabel={t('aria_share_link')}
          testId="share-link"
          disabled={!canShare || !hasEdits}
          title={
            !canShare ? t('tip_share_unset') : !hasEdits ? t('tip_share_nothing') : t('tip_share_link')
          }
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
