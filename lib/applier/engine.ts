import { browser } from 'wxt/browser';
import { isExtensionAlive, safeSendMessage } from '../extension-context';
import { applyAll, revertAll, revertRemoved } from '../edits/apply';
import { showMarker } from './marker';
import { readDomValue } from '../edits/dom';
import { loadPageEdits, pageKey, savePageEdits } from '../edits/storage';
import { resolveRecord } from '../selector/resolve';
import type { PageEdits } from '../edits/types';

const REAPPLY_DELAY_MS = 50;

export class ApplierEngine {
  private edits: PageEdits | null = null;
  private onOpenEditor: () => void = () => {};
  private observer: MutationObserver | null = null;
  private pending = false;
  private url = '';
  private loadSeq = 0;
  private paused = false;
  /**
   * The panel and its minimized pill already carry the edit count, so while either is
   * on screen the corner marker would say the same thing twice. It yields, and speaks
   * again when the editor closes.
   */
  private editorVisible = false;

  constructor(private doc: Document) {}

  /** What the on-page marker does when clicked. */
  whenOpened(handler: () => void): void {
    this.onOpenEditor = handler;
  }

  async start(url: string): Promise<void> {
    this.url = url;
    this.doc.addEventListener('pg-editor:preview', (e) => {
      this.paused = (e as CustomEvent<{ on?: boolean }>).detail?.on === true;
      if (!this.paused) this.applyNow();
    });
    this.doc.addEventListener('pg-editor:ui', (e) => {
      this.editorVisible = (e as CustomEvent<{ visible?: boolean }>).detail?.visible === true;
      this.syncMarker();
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
    if (!isExtensionAlive()) return;
    const seq = ++this.loadSeq;
    const edits = await loadPageEdits(url);
    if (this.url !== url || seq !== this.loadSeq) return;
    this.setEdits(edits);
  }

  private setEdits(edits: PageEdits | null): void {
    const previous = this.edits?.records ?? [];
    this.edits = edits && edits.records.length > 0 ? edits : null;
    safeSendMessage({ type: 'pg:count', count: this.edits?.records.length ?? 0 });
    if (this.edits) {
      revertRemoved(previous, this.edits.records, this.doc);
      this.applyNow();
      this.observe();
      this.syncMarker();
    } else {
      // Clearing a page from the popup reaches an already-open tab this way. Nothing is
      // going to reload it, so the page has to be put back here.
      revertAll(previous, this.doc);
      this.observer?.disconnect();
      this.observer = null;
      this.syncMarker();
    }
  }

  private syncMarker(): void {
    const count = this.editorVisible ? 0 : this.edits?.records.filter((r) => r.enabled).length ?? 0;
    showMarker(this.doc, count, this.onOpenEditor);
  }

  private applyNow(): void {
    if (this.paused || !this.edits) return;
    this.refreshBaselines();
    applyAll(this.edits.records, this.doc);
  }

  /**
   * When the site rewrites a value we edited — a price, a stock line, a lazy-loaded
   * src — the record's oldValue is a stale snapshot of a page that no longer exists.
   * Reapplying over the site's write is wanted; reverting to the snapshot is not, so
   * the site's value becomes the new baseline before we write on top of it.
   *
   * Our own writes are excluded by value: after applyAll the page holds newValue, and a
   * value equal to either side of the record is not news.
   */
  private refreshBaselines(): void {
    if (!this.edits) return;
    const updates: Array<{ id: string; oldValue: string }> = [];
    const records = this.edits.records.map((record) => {
      if (!record.enabled || (record.type !== 'text' && record.type !== 'attr')) return record;
      const el = resolveRecord(record, this.doc);
      const live = el ? readDomValue(el, record) : null;
      if (live === null || live === record.newValue || live === record.oldValue) return record;
      updates.push({ id: record.id, oldValue: live });
      // The attribute exists on the page now, whoever put it there.
      return { ...record, oldValue: live, absent: undefined };
    });
    if (updates.length === 0) return;
    this.edits = { ...this.edits, records };
    savePageEdits(this.edits).catch(() => {});
    // The panel keeps its own copy of the records; without this, its reset buttons
    // would still write the snapshot this method just retired.
    this.doc.dispatchEvent(new CustomEvent('pg-editor:baseline', { detail: { updates } }));
  }

  private observe(): void {
    if (this.observer) return;
    this.observer = new MutationObserver(() => this.scheduleReapply());
    this.observer.observe(this.doc.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      // Lazy loaders and gallery scripts rewrite these after we apply. Without watching
      // them an image edit was applied once and then quietly undone by the page.
      attributes: true,
      attributeFilter: ['src', 'srcset', 'sizes'],
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
