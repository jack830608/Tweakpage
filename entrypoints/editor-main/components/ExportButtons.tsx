import { browser } from 'wxt/browser';
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';

export function ExportButtons({ controller }: { controller: EditsController }) {
  const onJson = () => {
    const page = controller.getPage();
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    downloadFile(exportFilename(page.url, stamp), toJson(page));
  };
  const onMarkdown = async () => {
    const markdown = toMarkdown(controller.getPage(), new Date().toISOString().slice(0, 10));
    try {
      await navigator.clipboard.writeText(markdown);
    } catch {
      window.prompt('Copy the change list below:', markdown);
    }
  };
  return (
    <>
      <button type="button" onClick={onJson}>Export JSON</button>
      <button type="button" onClick={() => void onMarkdown()}>Copy Markdown</button>
    </>
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
