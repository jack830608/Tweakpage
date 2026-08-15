import { browser } from 'wxt/browser';
import { applyAll } from '../edits/apply';
import { loadPageEdits, pageKey } from '../edits/storage';
import type { PageEdits } from '../edits/types';

const REAPPLY_DELAY_MS = 50;

export class ApplierEngine {
  private edits: PageEdits | null = null;
  private observer: MutationObserver | null = null;
  private pending = false;
  private url = '';

  constructor(private doc: Document) {}

  async start(url: string): Promise<void> {
    this.url = url;
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const change = changes[pageKey(this.url)];
      if (change) this.setEdits((change.newValue as PageEdits | undefined) ?? null);
    });
    this.setEdits(await loadPageEdits(url));
  }

  async navigate(url: string): Promise<void> {
    this.url = url;
    this.setEdits(await loadPageEdits(url));
  }

  private setEdits(edits: PageEdits | null): void {
    this.edits = edits && edits.records.length > 0 ? edits : null;
    if (this.edits) {
      this.applyNow();
      this.observe();
    } else {
      this.observer?.disconnect();
      this.observer = null;
    }
  }

  private applyNow(): void {
    if (this.edits) applyAll(this.edits.records, this.doc);
  }

  private observe(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => this.scheduleReapply());
    this.observer.observe(this.doc.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  private scheduleReapply(): void {
    if (this.pending) return;
    this.pending = true;
    setTimeout(() => {
      this.pending = false;
      this.applyNow();
    }, REAPPLY_DELAY_MS);
  }
}
