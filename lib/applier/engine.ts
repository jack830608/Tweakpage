import { browser } from 'wxt/browser';
import { isExtensionAlive, safeSendMessage } from '../extension-context';
import { applyAll, revertAll, revertRemoved } from '../edits/apply';
import { sign } from './handshake';
import { removeMarker, showMarker } from './marker';
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
  /** True while inline text editing owns the element — a keystroke is a mutation. */
  private editing = false;
  /** What each record's baseline was when this page loaded. See refreshBaselines. */
  private arrivedWith = new Map<string, { oldValue: string; absent?: boolean }>();
  /** Records whose value the site keeps moving, so no reading of it is a baseline. */
  private volatile = new Set<string>();
  /**
   * What the editor told us about itself. The chip has one owner — this engine — and
   * one home; the editor only reports its state. 'open' silences the chip (the panel
   * footer carries the count), 'minimized' and 'closed' each give it a voice.
   */
  private editorUi: { state: 'open' | 'minimized' | 'closed'; shared: boolean; count: number } = {
    state: 'closed',
    shared: false,
    count: 0,
  };

  constructor(private doc: Document) {}

  /** What the on-page marker does when clicked. */
  whenOpened(handler: () => void): void {
    this.onOpenEditor = handler;
  }

  async start(url: string): Promise<void> {
    this.url = url;
    this.doc.addEventListener('tweakpage:preview', (e) => {
      this.paused = (e as CustomEvent<{ on?: boolean }>).detail?.on === true;
      if (!this.paused) this.applyNow();
    });
    this.doc.addEventListener('tweakpage:editing', (e) => {
      this.editing = (e as CustomEvent<{ on?: boolean }>).detail?.on === true;
      // Released: what was typed is recorded by now, so reapplying is a visual no-op.
      if (!this.editing) this.applyNow();
    });
    this.doc.addEventListener('tweakpage:ui', (e) => {
      const detail = (e as CustomEvent<Partial<typeof this.editorUi>>).detail;
      this.editorUi = {
        state: detail?.state ?? 'closed',
        shared: detail?.shared === true,
        count: typeof detail?.count === 'number' ? detail.count : 0,
      };
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
    // A different page is a different set of elements; what the last one was doing with
    // its values says nothing about this one.
    this.arrivedWith.clear();
    this.volatile.clear();
    const seq = ++this.loadSeq;
    const edits = await loadPageEdits(url);
    if (this.url !== url || seq !== this.loadSeq) return;
    this.setEdits(edits);
  }

  private setEdits(edits: PageEdits | null): void {
    const previous = this.edits?.records ?? [];
    this.edits = edits && edits.records.length > 0 ? edits : null;
    safeSendMessage({ type: 'tweakpage:count', count: this.edits?.records.length ?? 0 });
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
    const { state, shared } = this.editorUi;
    if (state === 'open') {
      removeMarker(this.doc);
      return;
    }
    // A shared preview lives nowhere but this tab, so its count rides on the event;
    // saved edits are counted from storage, which keeps the chip fresh as they change.
    const count = shared
      ? this.editorUi.count
      : this.edits?.records.filter((r) => r.enabled).length ?? 0;
    showMarker(this.doc, count, this.onOpenEditor, { shared, minimized: state === 'minimized' });
  }

  private applyNow(): void {
    if (this.paused || this.editing || !this.edits) return;
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
   *
   * A baseline is a claim that the site has settled somewhere new, and a carousel never
   * settles: it writes another frame every few seconds, and following each one in turn
   * left oldValue holding whichever picture the page happened to be passing through, so
   * Reset restored that instead of the image the page shipped with. One rewrite is
   * followed. A value that moves a second time is not a baseline at all — what arrived
   * from storage goes back, and this record stops being chased for as long as the page
   * stays open.
   */
  private refreshBaselines(): void {
    if (!this.edits) return;
    const updates: Array<{ id: string; oldValue: string }> = [];
    const records = this.edits.records.map((record) => {
      if (!record.enabled || (record.type !== 'text' && record.type !== 'attr')) return record;
      if (this.volatile.has(record.id)) return record;
      const el = resolveRecord(record, this.doc);
      const live = el ? readDomValue(el, record) : null;
      if (live === null || live === record.newValue || live === record.oldValue) return record;
      const arrived = this.arrivedWith.get(record.id);
      if (arrived === undefined) {
        this.arrivedWith.set(record.id, { oldValue: record.oldValue, absent: record.absent });
        updates.push({ id: record.id, oldValue: live });
        // The attribute exists on the page now, whoever put it there.
        return { ...record, oldValue: live, absent: undefined };
      }
      this.volatile.add(record.id);
      updates.push({ id: record.id, oldValue: arrived.oldValue });
      return { ...record, oldValue: arrived.oldValue, absent: arrived.absent };
    });
    if (updates.length === 0) return;
    this.edits = { ...this.edits, records };
    savePageEdits(this.edits).catch(() => {});
    // The panel keeps its own copy of the records; without this, its reset buttons
    // would still write the snapshot this method just retired.
    this.doc.dispatchEvent(new CustomEvent('tweakpage:baseline', { detail: sign({ updates }) }));
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
