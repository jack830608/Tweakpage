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

function viewportNote(record: EditRecord): string {
  return record.viewport ? ` _(at ${record.viewport}px)_` : '';
}

function formatLine(record: EditRecord): string {
  const note = viewportNote(record);
  if (record.type === 'text') return `- text: "${record.oldValue}" → "${record.newValue}"${note}`;
  if (record.type === 'attr') {
    return `- ${record.property}: \`${record.oldValue}\` → \`${record.newValue}\`${note}`;
  }
  return `- ${cssPropertyName(record.property)}: \`${record.oldValue}\` → \`${record.newValue}\`${note}`;
}
