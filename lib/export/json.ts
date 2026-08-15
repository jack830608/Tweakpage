import type { PageEdits } from '../edits/types';

export function toJson(page: PageEdits): string {
  return JSON.stringify(page, null, 2);
}

export function exportFilename(url: string, yyyymmdd: string): string {
  return `tweakpage-${new URL(url).hostname}-${yyyymmdd}.json`;
}
