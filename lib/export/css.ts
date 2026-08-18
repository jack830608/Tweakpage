import { cssPropertyName } from '../edits/css';
import { CLONE_ATTRIBUTE } from '../edits/dom';
import type { EditRecord, PageEdits } from '../edits/types';

/**
 * Rewrites a selector aimed at a copy Tweakpage created.
 *
 * The stamp only exists while the extension is running, so pasting it into a codebase
 * produces a rule that never matches. What the engineer needs to know is that the rule
 * belongs to a duplicated element they have yet to build.
 */
function readableSelector(selector: string): { selector: string; note?: string } {
  const stamp = new RegExp(`\\[${CLONE_ATTRIBUTE}="[^"]*"\\]`);
  if (!stamp.test(selector)) return { selector };
  return {
    selector: selector.replace(stamp, '/* the duplicated element */').trim() || '/* the duplicated element */',
    note: 'This rule belongs to a copy made in Tweakpage — see the duplicate in the change list.',
  };
}

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
    const widths = [...new Set(records.map((r) => r.viewport).filter(Boolean))];
    const at = widths.length > 0 ? ` — captured at ${widths.join('px, ')}px` : '';
    const readable = readableSelector(selector);
    lines.push(`/* ${records[0].elementLabel}${at} */`);
    if (readable.note) lines.push(`/* ${readable.note} */`);
    lines.push(`${readable.selector} {`);
    for (const record of records) {
      lines.push(`  ${cssPropertyName(record.property)}: ${record.newValue};`);
    }
    lines.push('}', '');
  }

  const others = page.records.filter((r) => r.type !== 'style' && r.enabled);
  if (others.length > 0) {
    lines.push('/* Not CSS — these need a content or markup change: */');
    for (const record of others) {
      const what =
        record.type === 'text' ? 'text'
        : record.type === 'move' ? `moved to position ${Number(record.newValue) + 1}`
        : record.type === 'clone' ? 'duplicated'
        : record.property;
      const change =
        record.type === 'move' || record.type === 'clone'
          ? ''
          : `: "${record.oldValue}" → "${record.newValue}"`;
      lines.push(`/*   ${readableSelector(record.selector).selector} — ${what}${change} */`);
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd() + '\n';
}
