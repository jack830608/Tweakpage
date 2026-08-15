import { applyAll, revertAll, type ApplyStatus } from '../../lib/edits/apply';
import { findRecord, upsertRecord } from '../../lib/edits/coalesce';
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

  recordEdit(el: Element, type: EditType, property: string, oldValue: string, newValue: string): void {
    const gen = this.genFor(el);
    const existing = findRecord(this.page.records, gen.selector, property);
    if (existing && newValue === existing.oldValue) {
      this.deleteRecord(existing.id);
      return;
    }
    if (!existing && newValue === oldValue) return;
    this.setRecords(
      upsertRecord(this.page.records, { ...gen, type, property, oldValue, newValue }, this.now()),
    );
  }

  deleteRecord(id: string): void {
    const record = this.page.records.find((r) => r.id === id);
    if (!record) return;
    if (record.type !== 'style') {
      const el = resolveRecord(record, this.doc);
      if (el) revertDomEdit(el, record);
    }
    this.setRecords(this.page.records.filter((r) => r.id !== id));
  }

  revertAllEdits(): void {
    revertAll(this.page.records, this.doc);
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

  private setRecords(records: EditRecord[]): void {
    this.page = { ...this.page, records, title: this.doc.title, updatedAt: this.now() };
    this.statuses = applyAll(records, this.doc);
    void savePageEdits(this.page);
    this.listeners.forEach((fn) => fn());
  }
}
