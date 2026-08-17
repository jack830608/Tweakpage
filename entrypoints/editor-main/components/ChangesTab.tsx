import { useRef, useState, useSyncExternalStore } from 'react';
import { cssPropertyName } from '../../../lib/edits/css';
import { importPageEdits, parseImport } from '../../../lib/edits/import';
import { normalizePageUrl } from '../../../lib/edits/storage';
import { resolveRecord } from '../../../lib/selector/resolve';
import { revealElement } from '../reveal';
import { ConfirmButton } from './ConfirmButton';
import type { EditRecord } from '../../../lib/edits/types';
import type { EditsController } from '../controller';
import type { ToastContent } from './Toast';
import { t } from '../../../lib/i18n';

interface ChangesTabProps {
  controller: EditsController;
  onToast: (toast: ToastContent) => void;
  onHighlight: (el: Element | null) => void;
  onSelectRecord: (el: Element) => void;
}

export function ChangesTab({ controller, onToast, onHighlight, onSelectRecord }: ChangesTabProps) {
  const page = useSyncExternalStore(controller.subscribe, controller.getPage);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const visible = needle
    ? page.records.filter((r) =>
        `${r.elementLabel} ${labelFor(r)} ${r.oldValue} ${r.newValue}`.toLowerCase().includes(needle),
      )
    : page.records;

  const onImportFile = async (file: File) => {
    const result = parseImport(await file.text());
    if (!result.ok) {
      onToast({ message: t('toast_import_failed', [result.error]) });
      return;
    }
    const suffix = result.skipped > 0 ? t('toast_skipped', [result.skipped]) : '';
    if (result.page.url === normalizePageUrl(location.href)) {
      controller.importRecords(result.page.records);
      onToast({ message: t('toast_imported', [result.page.records.length, suffix]) });
    } else {
      await importPageEdits(result.page);
      const host = new URL(result.page.url).hostname;
      onToast({ message: t('toast_imported_for', [result.page.records.length, host, suffix]) });
    }
  };

  return (
    <div className="pgve-changes">
      <div className="pgve-changes-actions">
        <button type="button" onClick={() => fileRef.current?.click()}>{t('import_json')}</button>
        {page.records.length > 0 && (
          <ConfirmButton
            label={t('revert_all')}
            ariaLabel={t('aria_revert_all')}
            onConfirm={() => controller.revertAllEdits()}
          />
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label={t('aria_import_json')} data-testid="import-json-file"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void onImportFile(file);
          }}
        />
      </div>
      {page.records.length > 3 && (
        <input
          type="search"
          className="pgve-changes-filter"
          aria-label={t('search_changes')}
          data-testid="filter-changes"
          placeholder={t('search_changes')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      {page.records.length === 0 ? (
        <p className="pgve-empty">{t('no_changes')}</p>
      ) : (
        <ul>
          {groupByElement(visible).map(([label, group]) => (
            <li key={label} className="pgve-change-group">
              <div className="pgve-change-group-head">
                <span className="pgve-change-group-label">{label}</span>
                <span className="pgve-change-group-count">{group.length}</span>
              </div>
              <ul>
          {group.map((record) => (
            <li
              key={record.id}
              className={record.enabled ? 'pgve-change' : 'pgve-change pgve-change-off'}
              onMouseEnter={() => onHighlight(resolveRecord(record, document))}
              onMouseLeave={() => onHighlight(null)}
            >
              <div className="pgve-change-head">
                {/* Selecting is a control, so it is a button: reachable by keyboard and
                    announced for what it does, rather than a click handler on a row. */}
                <button
                  type="button"
                  className="pgve-change-target"
                  aria-label={t('aria_select_change', [record.elementLabel])}
                  data-testid={`select-change-${record.id}`}
                  onFocus={() => onHighlight(resolveRecord(record, document))}
                  onBlur={() => onHighlight(null)}
                  onClick={() => {
                    const el = resolveRecord(record, document);
                    if (!el) return;
                    revealElement(el);
                    onSelectRecord(el);
                  }}
                >
                  {labelFor(record)}
                </button>
                <input
                  type="checkbox"
                  className="pgve-change-switch"
                  checked={record.enabled}
                  aria-label={t('aria_toggle_change', [labelFor(record)])}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => controller.toggleRecord(record.id)}
                />
              </div>
              <div className="pgve-change-diff">
                <s>{shorten(record.oldValue)}</s> → <b>{shorten(record.newValue)}</b>
              </div>
              {record.viewport !== undefined && farFromNow(record.viewport) && (
                <div className="pgve-change-viewport">{t('made_at_width', [record.viewport])}</div>
              )}
              {controller.getStatus(record.id) === 'not-found' && (
                <div className="pgve-change-warning">{t('couldnt_apply')}</div>
              )}
              <button
                type="button"
                aria-label={t('aria_delete_change', [labelFor(record)])}
                onClick={(e) => {
                  e.stopPropagation();
                  controller.deleteRecord(record.id);
                }}
              >
                {t('delete')}
              </button>
            </li>
          ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Far enough apart that a responsive layout has probably changed underneath the edit. */
function farFromNow(width: number): boolean {
  return Math.abs(width - window.innerWidth) > 200;
}

/** Several edits to one element belong together — a flat list buried that. */
function groupByElement(records: EditRecord[]): Array<[string, EditRecord[]]> {
  const groups = new Map<string, EditRecord[]>();
  for (const record of records) {
    groups.set(record.elementLabel, [...(groups.get(record.elementLabel) ?? []), record]);
  }
  return [...groups];
}

function labelFor(record: EditRecord): string {
  if (record.type === 'text') return 'text';
  if (record.type === 'attr') return record.property;
  return cssPropertyName(record.property);
}

function shorten(value: string): string {
  return value.length > 28 ? `${value.slice(0, 28)}…` : value;
}
