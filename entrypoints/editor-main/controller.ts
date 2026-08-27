import { browser } from 'wxt/browser';
import { applyAll, revertAll, revertRemoved, type ApplyStatus } from '../../lib/edits/apply';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'preview';
import { MARK_ATTRIBUTE } from '../../lib/edits/css';
import { findRecord, upsertRecord } from '../../lib/edits/coalesce';
import { mergeRecords } from '../../lib/edits/import';
import { revertDomEdit } from '../../lib/edits/dom';
import { loadPageEdits, normalizePageUrl, pageKey, savePageEdits } from '../../lib/edits/storage';
import {
  emptyPageEdits,
  makeId,
  type EditRecord,
  type EditType,
  type PageEdits,
  type Variant,
} from '../../lib/edits/types';
import { isOurs } from '../../lib/applier/handshake';
import { CLONE_ATTRIBUTE, elementIndex, isTweakpageNode, pageSiblings } from '../../lib/edits/dom';
import { generateSelector, type GeneratedSelector } from '../../lib/selector/generate';
import { resolveRecord, textStillMatches } from '../../lib/selector/resolve';
import { similarSelector } from '../../lib/selector/similar';

/** The words an element is recognised by — the same reading generateSelector takes. */
function textFingerprintOf(el: Element): string | undefined {
  return el.textContent?.trim().slice(0, 60) || undefined;
}

export class EditsController {
  private page: PageEdits;
  private statuses = new Map<string, ApplyStatus>();
  private listeners = new Set<() => void>();
  private selectorCache = new WeakMap<Element, GeneratedSelector>();
  /**
   * The words this element held after our own last text edit landed on it.
   *
   * genFor re-mints when an element's text stops matching its cached fingerprint, which
   * is right when the site moved the words and wrong when we did: the next edit on that
   * element was then stamped with the text the previous edit had just written. Renaming
   * a nav link to match a sidebar link and colouring it put the colour on the sidebar.
   */
  private ourText = new WeakMap<Element, string | undefined>();
  private previewing = false;
  /**
   * True while the page is showing edits that arrived from a share link.
   *
   * Following a link is looking, not adopting. Nothing reaches this machine's storage
   * until the reader keeps it or edits something of their own, so a colleague's proposal
   * cannot quietly become your saved copy of the page.
   */
  private sharedPreview = false;
  private undoStack: EditRecord[][] = [];
  private redoStack: EditRecord[][] = [];
  private lastEditTarget: string | null = null;
  /**
   * The element the user is typing directly into, while they are typing into it.
   *
   * Mid-keystroke an element holds words that are neither what it was called nor what
   * any record says yet, so the identity test recordFor applies would disown it — and a
   * disowned element gets a new record per keystroke instead of continuing the one being
   * typed. The session says which element that is; nothing else can tell this apart from
   * a page relabelling a node behind our back, which is the case the test is there for.
   */
  private inlineTarget: Element | null = null;
  private elementKeys = new WeakMap<Element, string>();
  private nextElementKey = 0;

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
    this.watchForClears();
    // The applier retires stale baselines when the site rewrites an edited value; the
    // panel's copy of the records has to follow, or its reset buttons write history.
    doc.addEventListener('tweakpage:baseline', (e) => {
      const detail = (e as CustomEvent<{ updates?: Array<{ id: string; oldValue: string }> }>).detail;
      // A page can dispatch this event too, and it decides what a reset restores.
      if (!isOurs(detail)) return;
      const updates = detail?.updates;
      if (!updates?.length) return;
      const byId = new Map(updates.map((u) => [u.id, u.oldValue]));
      this.page = {
        ...this.page,
        records: this.page.records.map((r) =>
          byId.has(r.id) ? { ...r, oldValue: byId.get(r.id)!, absent: undefined } : r,
        ),
      };
      this.listeners.forEach((fn) => fn());
    });
  }

  getPage = (): PageEdits => this.page;

  getStatus = (id: string): ApplyStatus | undefined => this.statuses.get(id);

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  /**
   * The record this element carries for this property, if it carries one.
   *
   * Keyed on the selector alone, this answered with somebody else's edit: on a wizard
   * that re-labels one list of buttons, step three's first option mints the selector
   * step one's first option did, and the panel showed step one's words under step
   * three's element. The lookup has to name the element, and it has to name it the same
   * way the page does, or the panel and the page describe different things.
   *
   * Our mark is that answer where it exists — applyAll puts it on the node it actually
   * changed. Where it does not, a record may still be about this element: not applied
   * yet, or applied and then the page rebuilt around it. That falls to the same
   * resolution the page is drawn with.
   */
  recordFor = (el: Element, property: string): EditRecord | undefined => {
    const marked = (el.getAttribute(MARK_ATTRIBUTE) ?? '').split(' ').filter(Boolean);
    // Held to the same identity test the page applies. A mark is only as fresh as the
    // last pass: between the site relabelling a node it kept and our next apply, the
    // mark still names the record for the words that used to be there, and the panel
    // read that record's oldValue as this element's original.
    const typing = el === this.inlineTarget;
    const own = this.page.records.find(
      (r) => marked.includes(r.id) && r.property === property && (typing || textStillMatches(r, el)),
    );
    if (own) return own;
    const candidate = findRecord(this.page.records, this.genFor(el).selector, property);
    return candidate && resolveRecord(candidate, el.ownerDocument) === el ? candidate : undefined;
  };

  /**
   * A name for an element that no two elements share.
   *
   * Only used to tell one keystroke's target from the last one's. A selector cannot do
   * it — that is the whole bug above — and the element itself cannot be a Map key
   * without pinning the page's nodes in memory.
   */
  private keyFor(el: Element): string {
    let key = this.elementKeys.get(el);
    if (!key) {
      key = `e${(this.nextElementKey += 1)}`;
      this.elementKeys.set(el, key);
    }
    return key;
  }

  /** Set for the length of an inline session. See inlineTarget. */
  setInlineTarget(el: Element | null): void {
    this.inlineTarget = el;
  }

  isPreviewingOriginal = (): boolean => this.previewing;

  isPreviewingShared = (): boolean => this.sharedPreview;

  /** Shows shared edits. Storage is left exactly as it was. */
  previewShared(records: EditRecord[]): void {
    this.sharedPreview = true;
    this.lastEditTarget = null;
    this.setRecords(mergeRecords(this.page.records, records));
  }

  /** Adopts what was being previewed, which is the point at which it becomes yours. */
  keepShared(): void {
    if (!this.sharedPreview) return;
    this.sharedPreview = false;
    this.persist();
    this.listeners.forEach((fn) => fn());
  }

  /** What the last write to storage did, so the panel can say the work is safe. */
  private saveState: SaveState = 'idle';
  private savedAt = '';

  getSaveState = (): { state: SaveState; at: string } =>
    this.sharedPreview
      ? { state: 'preview', at: '' }
      : { state: this.saveState, at: this.savedAt };

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
    this.doc.dispatchEvent(new CustomEvent('tweakpage:preview', { detail: { on } }));
    if (on) {
      revertAll(this.page.records, this.doc);
    } else {
      this.statuses = applyAll(this.page.records, this.doc);
    }
    this.listeners.forEach((fn) => fn());
  }

  recordEdit(el: Element, type: EditType, property: string, oldValue: string, newValue: string): void {
    // Editing a shared page is taking it on, so it stops being a preview and starts saving.
    this.sharedPreview = false;
    if (this.previewing) this.setPreviewOriginal(false);
    const gen = this.genFor(el);
    const target = `${this.keyFor(el)}\u0000${property}`;
    const existing = this.recordFor(el, property);
    if (existing && newValue === existing.oldValue) {
      this.deleteRecord(existing.id);
      return;
    }
    if (!existing && newValue === oldValue) return;
    // Only meaningful on the first record: a later coalesced edit sees the attribute we
    // ourselves set, and upsertRecord keeps the original absent flag with the original
    // oldValue.
    const absent = type === 'attr' && !el.hasAttribute(property) ? true : undefined;
    this.setRecords(
      upsertRecord(
        this.page.records,
        { ...gen, type, property, oldValue, newValue, absent, viewport: this.viewportWidth() },
        this.now(),
        existing,
      ),
      { mergeSnapshot: target === this.lastEditTarget },
    );
    this.lastEditTarget = target;
    // Read after the edit has been applied: this is what genFor will see next time, and
    // recognising it is how a later edit on this element keeps the fingerprint it began
    // with instead of adopting the words we just wrote.
    if (type === 'text') this.ourText.set(el, textFingerprintOf(el));
  }

  /** True when the element has a same-parent sibling in that direction to swap with. */
  canMove(el: Element, direction: -1 | 1): boolean {
    if (!el.parentElement) return false;
    const target = elementIndex(el) + direction;
    return target >= 0 && target < pageSiblings(el.parentElement).length;
  }

  /**
   * Swaps the element with its neighbour. from/to describe the live DOM, and recordEdit
   * compares against the record's original oldValue, so stepping back to where the
   * element started deletes the record instead of keeping a 2→1→2 no-op around.
   */
  moveElement(el: Element, direction: -1 | 1): void {
    if (!this.canMove(el, direction)) return;
    const from = elementIndex(el);
    this.recordEdit(el, 'move', 'domIndex', String(from), String(from + direction));
  }

  canClone(el: Element): boolean {
    return el.parentElement !== null && el !== this.doc.body && !isTweakpageNode(el);
  }

  /**
   * Inserts an editable copy right after the element.
   *
   * Not routed through recordEdit: its coalescing is keyed on (selector, property), and
   * a second Duplicate must be a second copy, not an update of the first.
   */
  cloneElement(el: Element): Element | null {
    if (!this.canClone(el)) return null;
    const gen = this.genFor(el);
    const record: EditRecord = {
      id: makeId(),
      ...gen,
      type: 'clone',
      property: 'clone',
      oldValue: '',
      newValue: '',
      enabled: true,
      viewport: this.viewportWidth(),
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.lastEditTarget = null;
    this.setRecords([...this.page.records, record]);
    return this.doc.querySelector(`[${CLONE_ATTRIBUTE}="${record.id}"]`);
  }

  /**
   * Points the local edits at images that have just been uploaded.
   *
   * A picked file lives in the record as base64 — the right thing before it exists
   * anywhere else, and dead weight once it does. Hosting it during a hand-off makes the
   * bytes redundant: they bloat storage, fill the change list with an unreadable wall,
   * and leave the shared page and this one describing the same image two different ways.
   *
   * Not an edit and not an undo step — the user changed nothing, the image simply has
   * an address now. Only a value that really was embedded bytes can be replaced, and
   * only by a URL, so a reply from the worker cannot rewrite anything else.
   */
  adoptHostedImages(hosted: EditRecord[]): void {
    const urls = new Map(
      hosted
        .filter((r) => /^https:\/\//.test(r.newValue))
        .map((r) => [r.id, r.newValue] as const),
    );
    let changed = false;
    const records = this.page.records.map((record) => {
      const url = urls.get(record.id);
      if (url === undefined || !record.newValue.startsWith('data:image/')) return record;
      changed = true;
      return { ...record, newValue: url, updatedAt: this.now() };
    });
    if (!changed) return;
    this.page = { ...this.page, records, updatedAt: this.now() };
    // The page is showing the bytes; point it at the address instead.
    this.statuses = applyAll(records, this.doc);
    this.persist();
    this.listeners.forEach((fn) => fn());
  }

  /** Notes explain, they don't change the page — no undo step, no reapply. */
  setNote(id: string, note: string): void {
    const trimmed = note.trim().slice(0, 500);
    this.page = {
      ...this.page,
      records: this.page.records.map((r) =>
        r.id === id ? { ...r, note: trimmed === '' ? undefined : trimmed, updatedAt: this.now() } : r,
      ),
      updatedAt: this.now(),
    };
    this.persist();
    this.listeners.forEach((fn) => fn());
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
    // The preview belonged to the page the link pointed at. Carrying it across a route
    // change would silently stop this page's own edits from ever being saved.
    this.sharedPreview = false;
    this.undoStack = [];
    this.redoStack = [];
    this.lastEditTarget = null;
    this.statuses = applyAll(this.page.records, this.doc);
    this.listeners.forEach((fn) => fn());
  }

  getVariants = (): Variant[] => this.page.variants ?? [];

  /**
   * Notices when this page's edits are deleted from somewhere else.
   *
   * Clearing a page from the popup removed the key; the panel, whose copy of the records
   * was read once at construction and never again, kept them in memory and wrote them
   * all back on the next keystroke. The clear silently never happened.
   *
   * Only removal is followed, deliberately. Adopting every foreign *change* would also
   * fix two tabs on one URL overwriting each other — but the applier writes this same
   * key on its own schedule from a separate bundle, so a watcher cannot tell that write
   * from another tab's, and treating it as one throws away the undo history. That case
   * is left alone rather than half-solved. See docs/known-issues.md.
   */
  private watchForClears(): void {
    const key = pageKey(this.page.url);
    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      // Chrome omits newValue on a removal; other runtimes send null. Both mean gone.
      if (!(key in changes) || (changes[key]!.newValue ?? null) !== null) return;
      if (this.sharedPreview || this.page.records.length === 0) return;
      revertAll(this.page.records, this.doc);
      this.page = emptyPageEdits(this.page.url, this.doc.title, this.now());
      this.undoStack = [];
      this.redoStack = [];
      this.lastEditTarget = null;
      this.statuses = new Map();
      this.listeners.forEach((fn) => fn());
    };
    try {
      browser.storage.local.onChanged.addListener(listener);
    } catch {
      // No storage means nothing else can be clearing it either.
    }
  }

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
    // Naming and keeping a proposal is deliberate: from here it is yours.
    this.sharedPreview = false;
    this.page = { ...this.page, variants, updatedAt: this.now() };
    this.persist();
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
    this.persist();
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

  /**
   * The one path to storage.
   *
   * A shared preview stops here: it is the reader's decision, not a side effect of
   * looking, that puts someone else's edits on this machine.
   */
  private persist(): void {
    if (this.sharedPreview) return;
    this.saveState = 'saving';
    savePageEdits(this.page)
      .then(() => {
        this.saveState = 'saved';
        this.savedAt = this.now();
      })
      .catch((error: unknown) => {
        console.warn('[tweakpage] failed to save edits', error);
        this.saveState = 'failed';
        // Storage is the only copy. Silently losing it is worse than any other failure here.
        this.doc.dispatchEvent(new CustomEvent('tweakpage:save-failed'));
      })
      .finally(() => this.listeners.forEach((fn) => fn()));
  }

  /**
   * Cached against the element, and re-taken when the element stops matching it.
   *
   * A GeneratedSelector describes an element at a moment: its fingerprint and its label
   * are the words it held when it was read. Keyed on the element alone, the cache
   * outlived that moment — on a wizard where React reuses one list of buttons and swaps
   * their words, an edit made on step two was minted with step one's fingerprint, could
   * not then recognise the element it had just been made from, and left the page
   * unchanged while the panel showed the edit as made.
   *
   * Re-reading is for the site moving the words, not us: a record's fingerprint has to
   * describe where its element started, and the moment to read that is when an edit
   * begins, not on the keystrokes after it.
   */
  private genFor(el: Element): GeneratedSelector {
    const cached = this.selectorCache.get(el);
    const text = textFingerprintOf(el);
    // Not while the user is typing into the element: mid-session its words are neither
    // where it started nor where it will end, and re-reading them stamped a record with
    // "d" as the text that identifies it.
    const oursNow = this.ourText.has(el) && this.ourText.get(el) === text;
    if (cached && (cached.textFingerprint === text || el === this.inlineTarget || oursNow)) {
      return cached;
    }
    const gen = generateSelector(el);
    this.selectorCache.set(el, gen);
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
    revertRemoved(this.page.records, records, this.doc);
    this.page = { ...this.page, records, title: this.doc.title, updatedAt: this.now() };
    this.statuses = applyAll(records, this.doc);
    this.persist();
    this.listeners.forEach((fn) => fn());
  }
}
