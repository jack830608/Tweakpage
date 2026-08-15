import { useSyncExternalStore } from 'react';
import { cssPropertyName } from '../../../lib/edits/css';
import type { EditRecord } from '../../../lib/edits/types';
import type { EditsController } from '../controller';

export function ChangesTab({ controller }: { controller: EditsController }) {
  const page = useSyncExternalStore(controller.subscribe, controller.getPage);
  if (page.records.length === 0) return <p className="pgve-empty">No changes yet.</p>;
  return (
    <div className="pgve-changes">
      <div className="pgve-changes-actions">
        <button type="button" onClick={() => controller.revertAllEdits()}>Revert all</button>
      </div>
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
