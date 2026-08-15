import { cssPropertyName } from '../edits/css';
import type { EditRecord, PageEdits } from '../edits/types';

export function toMarkdown(page: PageEdits, exportedAt: string): string {
  const lines = [
    `# Page edits — ${page.url}`,
    `Exported ${exportedAt} by PG Visual Editor`,
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
    for (const record of records) lines.push(formatLine(record));
    lines.push('');
  }
  return lines.join('\n');
}

function formatLine(record: EditRecord): string {
  if (record.type === 'text') return `- text: "${record.oldValue}" → "${record.newValue}"`;
  if (record.type === 'attr') return `- ${record.property}: \`${record.oldValue}\` → \`${record.newValue}\``;
  return `- ${cssPropertyName(record.property)}: \`${record.oldValue}\` → \`${record.newValue}\``;
}
