import { safeSendMessage } from '../../../lib/extension-context';
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { CameraIcon, CopyIcon, DownloadIcon } from './icons';
import { t } from '../../../lib/i18n';

interface ShareRowProps {
  controller: EditsController;
  onToast: (toast: ToastContent) => void;
  onSnapshot: () => void;
}

export function ShareRow({ controller, onToast, onSnapshot }: ShareRowProps) {
  const onJson = () => {
    const page = controller.getPage();
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    downloadFile(exportFilename(page.url, stamp), toJson(page));
    onToast({ message: t('toast_exported') });
  };
  const onMarkdown = async () => {
    const markdown = toMarkdown(controller.getPage(), new Date().toISOString().slice(0, 10));
    try {
      await navigator.clipboard.writeText(markdown);
      onToast({ message: t('toast_copied') });
    } catch {
      window.prompt('Copy the change list below:', markdown);
    }
  };

  return (
    <div className="pgve-share">
      <span className="pgve-share-label">{t('share')}</span>
      <div className="pgve-share-buttons">
        <button
          type="button"
          aria-label="Copy summary"
          title="Copy a Markdown summary for engineers"
          onClick={() => void onMarkdown()}
        >
          <CopyIcon /> {t('share_copy')}
        </button>
        <button type="button" aria-label="Export JSON" title="Download the edits as JSON" onClick={onJson}>
          <DownloadIcon /> {t('share_export')}
        </button>
        <button
          type="button"
          aria-label="Snapshot before and after"
          title="Save before & after screenshots"
          onClick={onSnapshot}
        >
          <CameraIcon /> {t('share_snap')}
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
