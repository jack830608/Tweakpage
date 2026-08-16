import { applyAll, revertAll, type ApplyStatus } from '../../lib/edits/apply';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';
import { findRecord, upsertRecord } from '../../lib/edits/coalesce';
import { mergeRecords } from '../../lib/edits/import';
import { revertDomEdit } from '../../lib/edits/dom';
import { loadPageEdits, normalizePageUrl, savePageEdits } from '../../lib/edits/storage';
import {
  emptyPageEdits,
  makeId,
  type EditRecord,
  type EditType,
  type PageEdits,
  type Variant,
} from '../../lib/edits/types';
import { generateSelector, type GeneratedSelector } from '../../lib/selector/generate';
import { resolveRecord } from '../../lib/selector/resolve';
import { similarSelector } from '../../lib/selector/similar';

export class EditsController {
  private page: PageEdits;
  private statuses = new Map<string, ApplyStatus>();
  private listeners = new Set<() => void>();
  private selectorCache = new WeakMap<Element, GeneratedSelector>();
  private previewing = false;
  private undoStack: EditRecord[][] = [];
  private redoStack: EditRecord[][] = [];
  private lastEditTarget: string | null = null;

  constructor(
    initial: PageEdits | null,
    private doc: Document,
    private now: () => string = () => new Date().toISOString(),
  ) {
    this.page =
      initial ?? emptyPageEdits(normalizePageUrl(doc.location.href), doc.title, this.now());
    if (this.page.records.length > 0) {
      this.statuses = applyAll(this.page.records, this.doc);
    }
  }

  getPage = (): PageEdits => this.page;

  getStatus = (id: string): ApplyStatus | undefined => this.statuses.get(id);

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  recordFor = (el: Element, property: string): EditRecord | undefined =>
    findRecord(this.page.records, this.genFor(el).selector, property);

  isPreviewingOriginal = (): boolean => this.previewing;

  /** What the last write to storage did, so the panel can say the work is safe. */
  private saveState: SaveState = 'idle';
  private savedAt = '';

  getSaveState = (): { state: SaveState; at: string } => ({ state: this.saveState, at: this.savedAt });

  canUndo = (): boolean => this.undoStack.length > 0;

  canRedo = (): boolean => this.redoStack.length > 0;

  undo(): void {
    const target = this.undoStack.pop();
    if (!target) return;
    if (this.previewing) this.setPreviewOriginal(false);
    this.lastEditTarget = null;
    this.redoStack.push(this.page.records);
    this.transitionTo(target);
  }

  redo(): void {
    const target = this.redoStack.pop();
    if (!target) return;
    if (this.previewing) this.setPreviewOriginal(false);
    this.lastEditTarget = null;
    this.undoStack.push(this.page.records);
    this.transitionTo(target);
  }

  setPreviewOriginal(on: boolean): void {
    if (this.previewing === on) return;
    this.previewing = on;
    this.doc.dispatchEvent(new CustomEvent('pg-editor:preview', { detail: { on } }));
    if (on) {
      revertAll(this.page.records, this.doc);
    } else {
      this.statuses = applyAll(this.page.records, this.doc);
    }
    this.listeners.forEach((fn) => fn());
  }

  recordEdit(el: Element, type: EditType, property: string, oldValue: string, newValue: string): void {
    if (this.previewing) this.setPreviewOriginal(false);
    const gen = this.genFor(el);
    const target = `${gen.selector}\u0000${property}`;
    const existing = findRecord(this.page.records, gen.selector, property);
    if (existing && newValue === existing.oldValue) {
      this.deleteRecord(existing.id);
      return;
    }
    if (!existing && newValue === oldValue) return;
    this.setRecords(
      upsertRecord(
        this.page.records,
        { ...gen, type, property, oldValue, newValue, viewport: this.viewportWidth() },
        this.now(),
      ),
      { mergeSnapshot: target === this.lastEditTarget },
    );
    this.lastEditTarget = target;
  }

  deleteRecord(id: string): void {
    if (this.previewing) this.setPreviewOriginal(false);
    this.lastEditTarget = null;
    const record = this.page.records.find((r) => r.id === id);
    if (!record) return;
    this.setRecords(this.page.records.filter((r) => r.id !== id));
  }

  toggleRecord(id: string): void {
    if (this.previewing) this.setPreviewOriginal(false);
    this.lastEditTarget = null;
    this.setRecords(
      this.page.records.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  importRecords(records: EditRecord[]): void {
    if (this.previewing) this.setPreviewOriginal(false);
    this.lastEditTarget = null;
    this.setRecords(mergeRecords(this.page.records, records));
  }

  private viewportWidth(): number | undefined {
    const width = this.doc.defaultView?.innerWidth;
    return typeof width === 'number' && width > 0 ? width : undefined;
  }

  /** How many other elements this one belongs with, if any. */
  similarTo(el: Element): { selector: string; count: number } | null {
    return similarSelector(el);
  }

  /** True when this element's style edits are already pointed at the whole family. */
  appliesToSimilar(el: Element): boolean {
    const set = similarSelector(el);
    if (!set) return false;
    return this.page.records.some((r) => r.scope === 'similar' && r.selector === set.selector);
  }

  /**
   * Re-points this element's style edits at every similar element, or back at the one.
   *
   * Selectors are made unique on purpose, which is right for "change this heading" and
   * useless for "change all the buttons" — this is the deliberate way to say the latter.
   */
  setSimilarScope(el: Element, all: boolean): void {
    const set = similarSelector(el);
    if (!set) return;
    const own = this.genFor(el);
    const from = all ? own.selector : set.selector;
    const to = all ? set.selector : own.selector;
    const moved = this.page.records.map((record) =>
      record.type === 'style' && record.selector === from
        ? {
            ...record,
            selector: to,
            scope: all ? ('similar' as const) : ('element' as const),
            elementLabel: all ? `${set.count} × ${record.elementLabel}` : own.elementLabel,
            updatedAt: this.now(),
          }
        : record,
    );
    if (moved.some((r, i) => r !== this.page.records[i])) {
      this.lastEditTarget = null;
      this.setRecords(moved);
    }
  }

  /**
   * Follows a client-side route change.
   *
   * The editor used to close itself on navigation, so using a single-page app meant
   * reopening from the toolbar after every link. The undo history belongs to the page
   * that was open, so it starts again here.
   */
  async navigate(url: string): Promise<void> {
    const next = normalizePageUrl(url);
    if (next === this.page.url) return;
    revertAll(this.page.records, this.doc);
    const loaded = await loadPageEdits(url);
    if (normalizePageUrl(this.doc.location.href) !== next) return;
    this.page = loaded ?? emptyPageEdits(next, this.doc.title, this.now());
    this.undoStack = [];
    this.redoStack = [];
    this.lastEditTarget = null;
    this.statuses = applyAll(this.page.records, this.doc);
    this.listeners.forEach((fn) => fn());
  }

  getVariants = (): Variant[] => this.page.variants ?? [];

  /**
   * Keeps the current edits as a named proposal.
   *
   * Comparing two directions meant exporting one, reverting, rebuilding the other, and
   * holding both in your head. A variant is the same records under a name; switching
   * between them is an ordinary transition, so undo, replay and export all keep working.
   */
  saveVariant(name: string): void {
    const trimmed = name.trim().slice(0, 60);
    if (trimmed === '') return;
    const existing = this.getVariants().find((v) => v.name === trimmed);
    const variant: Variant = {
      id: existing?.id ?? makeId(),
      name: trimmed,
      records: this.page.records,
      savedAt: this.now(),
    };
    const variants = existing
      ? this.getVariants().map((v) => (v.id === existing.id ? variant : v))
      : [...this.getVariants(), variant];
    this.page = { ...this.page, variants, updatedAt: this.now() };
    savePageEdits(this.page).catch(() => {});
    this.listeners.forEach((fn) => fn());
  }

  /** Loads a saved proposal over the live edits. Undo puts the previous set back. */
  loadVariant(id: string): void {
    const variant = this.getVariants().find((v) => v.id === id);
    if (!variant) return;
    this.lastEditTarget = null;
    this.setRecords(variant.records);
  }

  deleteVariant(id: string): void {
    const variants = this.getVariants().filter((v) => v.id !== id);
    this.page = { ...this.page, variants, updatedAt: this.now() };
    savePageEdits(this.page).catch(() => {});
    this.listeners.forEach((fn) => fn());
  }

  /** Clears several properties of one element as a single undo step. */
  resetProperties(el: Element, properties: string[]): void {
    if (this.previewing) this.setPreviewOriginal(false);
    this.lastEditTarget = null;
    const { selector } = this.genFor(el);
    const doomed = new Set(properties);
    const next = this.page.records.filter(
      (r) => !(r.selector === selector && doomed.has(r.property)),
    );
    if (next.length === this.page.records.length) return;
    this.setRecords(next);
  }

  revertAllEdits(): void {
    if (this.previewing) this.setPreviewOriginal(false);
    this.lastEditTarget = null;
    this.setRecords([]);
  }

  private genFor(el: Element): GeneratedSelector {
    let gen = this.selectorCache.get(el);
    if (!gen) {
      gen = generateSelector(el);
      this.selectorCache.set(el, gen);
    }
    return gen;
  }

  private setRecords(records: EditRecord[], { mergeSnapshot = false } = {}): void {
    if (!mergeSnapshot) {
      this.undoStack.push(this.page.records);
      if (this.undoStack.length > 50) this.undoStack.shift();
    }
    this.redoStack = [];
    this.transitionTo(records);
  }

  private transitionTo(records: EditRecord[]): void {
    if (normalizePageUrl(this.doc.location.href) !== this.page.url) {
      console.warn('[tweakpage] ignoring edit for stale URL', this.page.url);
      return;
    }
    for (const record of this.page.records) {
      if (record.type === 'style' || !record.enabled) continue;
      const survives = records.some(
        (r) => r.selector === record.selector && r.property === record.property && r.enabled,
      );
      if (!survives) {
        const el = resolveRecord(record, this.doc);
        if (el) revertDomEdit(el, record);
      }
    }
    this.page = { ...this.page, records, title: this.doc.title, updatedAt: this.now() };
    this.statuses = applyAll(records, this.doc);
    savePageEdits(this.page).catch((error: unknown) => {
      console.warn('[tweakpage] failed to save edits', error);
      // Storage is the only copy. Silently losing it is worse than any other failure here.
      this.doc.dispatchEvent(new CustomEvent('pg-editor:save-failed'));
    });
    this.listeners.forEach((fn) => fn());
  }
}
