import { useSyncExternalStore } from 'react';
import { browser } from 'wxt/browser';
import { exportFilename, toJson } from '../../../lib/export/json';
import { toMarkdown } from '../../../lib/export/markdown';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';

interface ActionRowProps {
  controller: EditsController;
  selected: Element | null;
  onDeselect: () => void;
  onSelect: (el: Element) => void;
  onToast: (toast: ToastContent) => void;
}

export function ActionRow({ controller, selected, onDeselect, onSelect, onToast }: ActionRowProps) {
  const previewing = useSyncExternalStore(controller.subscribe, controller.isPreviewingOriginal);

  const onHide = () => {
    if (!selected) return;
    const el = selected;
    controller.recordEdit(el, 'style', 'display', getComputedStyle(el).display, 'none');
    const record = controller.recordFor(el, 'display');
    onDeselect();
    onToast({
      message: 'Element hidden',
      actionLabel: 'Undo',
      onAction: () => {
        if (record) controller.deleteRecord(record.id);
        onSelect(el);
      },
    });
  };
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
    <div className="pgve-action-row">
      <button
        type="button"
        aria-label="Hide element"
        title="Hide the selected element"
        disabled={!selected || previewing}
        onClick={onHide}
      >
        🙈 Hide
      </button>
      <button
        type="button"
        aria-label="Copy summary"
        title="Copy a Markdown summary for engineers"
        onClick={() => void onMarkdown()}
      >
        📋 Copy
      </button>
      <button type="button" aria-label="Export JSON" title="Download the edits as JSON" onClick={onJson}>
        ⤓ Export
      </button>
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
