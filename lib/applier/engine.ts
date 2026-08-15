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
  private loadSeq = 0;
  private paused = false;

  constructor(private doc: Document) {}

  async start(url: string): Promise<void> {
    this.url = url;
    this.doc.addEventListener('pg-editor:preview', (e) => {
      this.paused = (e as CustomEvent<{ on?: boolean }>).detail?.on === true;
      if (!this.paused) this.applyNow();
    });
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const change = changes[pageKey(this.url)];
      if (change) {
        this.loadSeq++;
        this.setEdits((change.newValue as PageEdits | undefined) ?? null);
      }
    });
    await this.loadFor(url);
  }

  async navigate(url: string): Promise<void> {
    this.url = url;
    await this.loadFor(url);
  }

  private async loadFor(url: string): Promise<void> {
    const seq = ++this.loadSeq;
    const edits = await loadPageEdits(url);
    if (this.url !== url || seq !== this.loadSeq) return;
    this.setEdits(edits);
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
    if (!this.paused && this.edits) applyAll(this.edits.records, this.doc);
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
