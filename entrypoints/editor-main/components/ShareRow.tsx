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
import { hasConsented, recordConsent } from '../../../lib/share/consent';
import { embeddedImages } from '../../../lib/share/images';
import { getShareStatus, type HandOff } from '../../../lib/share/settings';
import { AsyncButton } from './AsyncButton';
import { TransferConsent } from './TransferConsent';
import { CameraIcon, CopyIcon, DownloadIcon, LinkIcon } from './icons';
import { t } from '../../../lib/i18n';

/** A hand-off waiting on the one question worth interrupting for. */
interface Pending {
  bucket: string;
  images: number;
  /** The page's own contents go up, not only its pictures. */
  page: boolean;
  compressing: boolean;
  run: (allowUpload: boolean) => Promise<unknown>;
}

interface ShareRowProps {
  controller: EditsController;
  onToast: (toast: ToastContent) => void;
  /** Resolves when the captures are composed and saved; false on failure. */
  onSnapshot: () => Promise<boolean>;
  /** Where to send someone who pressed Share link before setting up a bucket. */
  onNeedsSetup: () => void;
}

export function ShareRow({ controller, onToast, onSnapshot, onNeedsSetup }: ShareRowProps) {
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
  const [pending, setPending] = useState<Pending | null>(null);

  /**
   * Asks before anything leaves the machine, once per bucket.
   *
   * The question comes first and the work happens once: doing it and then offering to
   * do it again would leave two shares behind, and one of them already public.
   *
   * What is being asked about is what actually leaves, and that is not only the images.
   * A share link IS an upload — the page's addresses, titles, every old and new value
   * and every note are written to a public object whether or not a picture is involved.
   * Gated on images alone, a page with none was uploaded on the first press with no
   * question asked at all, and pressing "not now" on a page with some uploaded it
   * anyway while the toast said nothing had gone.
   */
  const withConsent = async (handOff: HandOff, run: (allowUpload: boolean) => Promise<unknown>) => {
    const status = await getShareStatus();
    const images = embeddedImages(controller.getPage()).length;
    // Only a share link sends the page itself; the other three are local files and a
    // clipboard, and for those the images are the only thing that could travel.
    const sendsPage = handOff === 'share' && status.configured;
    const sendsImages = status.configured && status.uploadImages[handOff] && images > 0;
    if ((!sendsPage && !sendsImages) || (await hasConsented(status.bucket))) return run(true);

    return new Promise<unknown>((resolve) => {
      setPending({
        bucket: status.bucket,
        images: sendsImages ? images : 0,
        page: sendsPage,
        compressing: sendsImages && status.compressImages && status.compressionAvailable,
        run: async (allowUpload) => {
          setPending(null);
          if (allowUpload) {
            safeSendMessage({ type: 'tweakpage:transfer-consent', bucket: status.bucket });
            // The worker reads consent from storage, so wait for the write to land.
            await recordConsent(status.bucket);
          } else if (sendsPage) {
            // There is no link without an upload. Running it "locally" would produce a
            // link to an object that was never written, or write it after all.
            onToast({ message: t('toast_share_declined'), kind: 'info' });
            resolve(false);
            return false;
          } else {
            onToast({ message: t('toast_transfer_declined'), kind: 'info' });
          }
          const result = await run(allowUpload);
          resolve(result);
          return result;
        },
      });
    });
  };

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
  const prepare = async (handOff: HandOff, allowUpload: boolean) => {
    const page = controller.getPage();
    const result = (await browser.runtime
      .sendMessage({ type: 'tweakpage:host-images', page, handOff, allowUpload })
      .catch(() => null)) as { page?: PageEdits; report?: ImageReport } | null;
    // An image that now has an address does not need its bytes kept here as well.
    if (result?.page) controller.adoptHostedImages(result.page.records);
    return { page: result?.page ?? page, report: result?.report };
  };

  const onShareLink = async (allowUpload = true) => {
    const page = controller.getPage();
    const id = makeShareId();
    const result = (await browser.runtime
      .sendMessage({ type: 'tweakpage:share-put', id, page, allowUpload })
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

  const onJsonFile = async (allowUpload = true) => {
    const { page, report } = await prepare('download', allowUpload);
    downloadFile(exportFilename(page.url, today().replaceAll('-', '')), toJson(page));
    onToast({ message: imageMessage(t('toast_exported'), report), kind: 'success' });
  };

  return (
    <>
      {pending && (
        <TransferConsent
          bucket={pending.bucket}
          images={pending.images}
          page={pending.page}
          compressing={pending.compressing}
          onAgree={() => void pending.run(true)}
          onCancel={() => void pending.run(false)}
        />
      )}
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
          disabled={!hasEdits}
          title={t('tip_copy_summary')}
          run={() =>
            withConsent('summary', async (allowUpload) => {
              const { page, report } = await prepare('summary', allowUpload);
              await copy(toMarkdown(page, today()), imageMessage(t('toast_copied'), report));
            })
          }
        />
        <AsyncButton
          icon={<CameraIcon />}
          label={t('share_snap')}
          busyLabel={t('snap_busy')}
          doneLabel={t('snap_done')}
          ariaLabel={t('aria_snapshot')}
          testId="snapshot-before-and-after"
          disabled={!hasEdits}
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
          disabled={!hasEdits}
          title={t('tip_copy_json')}
          run={() =>
            withConsent('json', async (allowUpload) => {
              const { page, report } = await prepare('json', allowUpload);
              await copy(toJson(page), imageMessage(t('toast_copied_json'), report));
            })
          }
        />
        <AsyncButton
          icon={<DownloadIcon />}
          label={t('share_download')}
          busyLabel={t('preparing')}
          doneLabel={t('snap_done')}
          ariaLabel={t('aria_export_json')}
          testId="export-json"
          disabled={!hasEdits}
          title={t('tip_export')}
          run={() => withConsent('download', onJsonFile)}
        />
        <AsyncButton
          icon={<LinkIcon />}
          label={t('share_link')}
          busyLabel={t('share_link_busy')}
          doneLabel={t('share_link_done')}
          ariaLabel={t('aria_share_link')}
          testId="share-link"
          // Live without a bucket on purpose. Disabled, its only explanation was a native
          // title on a button nobody has a reason to hover — the product's headline
          // feature failing silently and anonymously. Pressing it now takes you to the
          // one place that can fix it.
          disabled={!hasEdits}
          title={
            !canShare ? t('tip_share_unset') : !hasEdits ? t('tip_share_nothing') : t('tip_share_link')
          }
          run={async () => {
            if (!canShare) {
              onNeedsSetup();
              onToast({ message: t('toast_share_needs_setup'), kind: 'info' });
              // Not a success: nothing was shared, so no confirmation flash.
              return false;
            }
            return withConsent('share', onShareLink);
          }}
        />
      </div>
    </div>
    </>
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
