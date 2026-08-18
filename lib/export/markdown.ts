import { cssPropertyName } from '../edits/css';
import type { EditRecord, PageEdits } from '../edits/types';

export function toMarkdown(page: PageEdits, exportedAt: string): string {
  const lines = [
    `# Page edits — ${page.url}`,
    `Exported ${exportedAt} by Tweakpage`,
    '',
  ];
  const groups = new Map<string, EditRecord[]>();
  for (const record of page.records) {
    const list = groups.get(record.elementLabel) ?? [];
    list.push(record);
    groups.set(record.elementLabel, list);
  }
  for (const [label, records] of groups) {
    lines.push(`## ${label}`);
    lines.push('');
    lines.push(`\`${records[0].selector}\``);
    lines.push('');
    for (const record of records) lines.push(formatLine(record));
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * What an image value looks like in a ticket.
 *
 * A data: URL is hundreds of kilobytes of base64. Pasted into Slack it buries the change
 * list it was supposed to explain, so it is named and measured instead. When the image
 * was uploaded it is already a URL by the time this runs, and stays one.
 */
function readable(value: string): string {
  if (!value.startsWith('data:image/')) return value;
  const mediaType = value.slice('data:'.length, value.indexOf(';'));
  const kb = Math.max(1, Math.round((value.length * 3) / 4 / 1024));
  return `[${mediaType}, ${kb} KB — embedded, not uploaded]`;
}

function viewportNote(record: EditRecord): string {
  return record.viewport ? ` _(at ${record.viewport}px)_` : '';
}

function formatLine(record: EditRecord): string {
  const note = viewportNote(record);
  // The author's why, right under the what — it turns a change list into a brief.
  const why = record.note ? `\n  - ${record.note}` : '';
  // Structural changes are work an engineer has to do; leaving them out of the list
  // reads as "nothing to build here".
  if (record.type === 'move') {
    const from = Number(record.oldValue) + 1;
    const to = Number(record.newValue) + 1;
    return `- **moved**: position ${from} → position ${to} among its siblings${note}${why}`;
  }
  if (record.type === 'clone') {
    return `- **duplicated**: a copy of this element, inserted right after it${note}${why}`;
  }
  const from = readable(record.oldValue);
  const to = readable(record.newValue);
  if (record.type === 'text') return `- text: "${record.oldValue}" → "${record.newValue}"${note}${why}`;
  if (record.type === 'attr') return `- ${record.property}: \`${from}\` → \`${to}\`${note}${why}`;
  return `- ${cssPropertyName(record.property)}: \`${from}\` → \`${to}\`${note}${why}`;
}
