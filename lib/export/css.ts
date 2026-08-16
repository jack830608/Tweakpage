import { cssPropertyName } from '../edits/css';
import type { EditRecord, PageEdits } from '../edits/types';

/**
 * A stylesheet an engineer can paste straight into the codebase.
 *
 * The applier targets its own marker attribute, which is meaningless outside the
 * extension, so this export goes back to the selector the record was recorded against
 * and groups the properties per element the way a person would write them.
 */
export function toCss(page: PageEdits, exportedAt: string): string {
  const styles = page.records.filter((r) => r.type === 'style' && r.enabled);
  const lines = [`/* ${page.url} */`, `/* Exported ${exportedAt} by Tweakpage */`, ''];

  const groups = new Map<string, EditRecord[]>();
  for (const record of styles) {
    groups.set(record.selector, [...(groups.get(record.selector) ?? []), record]);
  }
  for (const [selector, records] of groups) {
    lines.push(`/* ${records[0].elementLabel} */`);
    lines.push(`${selector} {`);
    for (const record of records) {
      lines.push(`  ${cssPropertyName(record.property)}: ${record.newValue};`);
    }
    lines.push('}', '');
  }

  const others = page.records.filter((r) => r.type !== 'style' && r.enabled);
  if (others.length > 0) {
    lines.push('/* Not CSS — these need a content or markup change: */');
    for (const record of others) {
      const what = record.type === 'text' ? 'text' : record.property;
      lines.push(`/*   ${record.selector} — ${what}: "${record.oldValue}" → "${record.newValue}" */`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}
