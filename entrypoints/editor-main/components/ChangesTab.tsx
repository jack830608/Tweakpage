import { useRef, useSyncExternalStore } from 'react';
import { cssPropertyName } from '../../../lib/edits/css';
import { importPageEdits, parseImport } from '../../../lib/edits/import';
import { normalizePageUrl } from '../../../lib/edits/storage';
import type { EditRecord } from '../../../lib/edits/types';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';

interface ChangesTabProps {
  controller: EditsController;
  onToast: (toast: ToastContent) => void;
}

export function ChangesTab({ controller, onToast }: ChangesTabProps) {
  const page = useSyncExternalStore(controller.subscribe, controller.getPage);
  const fileRef = useRef<HTMLInputElement>(null);

  const onImportFile = async (file: File) => {
    const result = parseImport(await file.text());
    if (!result.ok) {
      onToast({ message: `Import failed: ${result.error}` });
      return;
    }
    const suffix = result.skipped > 0 ? ` (${result.skipped} skipped)` : '';
    if (result.page.url === normalizePageUrl(location.href)) {
      controller.importRecords(result.page.records);
      onToast({ message: `Imported ${result.page.records.length} edits${suffix}` });
    } else {
      await importPageEdits(result.page);
      const host = new URL(result.page.url).hostname;
      onToast({
        message: `Imported ${result.page.records.length} edits for ${host}${suffix} — open that page to see them`,
      });
    }
  };

  return (
    <div className="pgve-changes">
      <div className="pgve-changes-actions">
        <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
        {page.records.length > 0 && (
          <button type="button" onClick={() => controller.revertAllEdits()}>Revert all</button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Import JSON file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onImportFile(file);
          }}
        />
      </div>
      {page.records.length === 0 ? (
        <p className="pgve-empty">No changes yet.</p>
      ) : (
        <ul>
          {page.records.map((record) => (
            <li key={record.id} className="pgve-change">
              <div className="pgve-change-target">{record.elementLabel}</div>
              <div className="pgve-change-diff">
                {labelFor(record)}: <s>{shorten(record.oldValue)}</s> → <b>{shorten(record.newValue)}</b>
              </div>
              {controller.getStatus(record.id) === 'not-found' && (
                <div className="pgve-change-warning">Couldn't apply on this page</div>
              )}
              <button
                type="button"
                aria-label={`Delete ${labelFor(record)} change`}
                onClick={() => controller.deleteRecord(record.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelFor(record: EditRecord): string {
  if (record.type === 'text') return 'text';
  if (record.type === 'attr') return record.property;
  return cssPropertyName(record.property);
}

function shorten(value: string): string {
  return value.length > 40 ? `${value.slice(0, 40)}…` : value;
}
