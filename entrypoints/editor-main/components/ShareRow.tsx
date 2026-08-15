import { browser } from 'wxt/browser';
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { CameraIcon, CopyIcon, DownloadIcon } from './icons';

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
    onToast({ message: 'JSON exported — check your downloads' });
  };
  const onMarkdown = async () => {
    const markdown = toMarkdown(controller.getPage(), new Date().toISOString().slice(0, 10));
    try {
      await navigator.clipboard.writeText(markdown);
      onToast({ message: 'Summary copied to clipboard' });
    } catch {
      window.prompt('Copy the change list below:', markdown);
    }
  };

  return (
    <div className="pgve-share">
      <span className="pgve-share-label">Share</span>
      <div className="pgve-share-buttons">
        <button
          type="button"
          aria-label="Copy summary"
          title="Copy a Markdown summary for engineers"
          onClick={() => void onMarkdown()}
        >
          <CopyIcon /> Copy
        </button>
        <button type="button" aria-label="Export JSON" title="Download the edits as JSON" onClick={onJson}>
          <DownloadIcon /> Export
        </button>
        <button
          type="button"
          aria-label="Snapshot before and after"
          title="Save before & after screenshots"
          onClick={onSnapshot}
        >
          <CameraIcon /> Snap
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
  browser.runtime.sendMessage({ type: 'pg:download', filename, url }).catch(() => {});
}

function toBase64(content: string): string {
  const bytes = new TextEncoder().encode(content);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
