import { applyAll, revertAll, type ApplyStatus } from '../../lib/edits/apply';
import { findRecord, upsertRecord } from '../../lib/edits/coalesce';
import { mergeRecords } from '../../lib/edits/import';
import { revertDomEdit } from '../../lib/edits/dom';
import { normalizePageUrl, savePageEdits } from '../../lib/edits/storage';
import { emptyPageEdits, type EditRecord, type EditType, type PageEdits } from '../../lib/edits/types';
import { generateSelector, type GeneratedSelector } from '../../lib/selector/generate';
import { resolveRecord } from '../../lib/selector/resolve';

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
      upsertRecord(this.page.records, { ...gen, type, property, oldValue, newValue }, this.now()),
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
    });
    this.listeners.forEach((fn) => fn());
  }
}
