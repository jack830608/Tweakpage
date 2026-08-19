import { browser } from 'wxt/browser';

/**
 * Parts of a page Tweakpage will not offer to edit.
 *
 * Not a permission — everything here runs in your own browser on your own copy of the
 * DOM, so nothing in this file stops anybody from doing anything. It exists because
 * some edits are guaranteed waste: a chat launcher, a consent banner, a third-party
 * widget whose classes are generated fresh on every deploy. An edit recorded there
 * reproduces for nobody, and the person receiving the hand-off gets a line they cannot
 * act on.
 *
 * Rules match the element or any of its ancestors, so excluding a widget's root
 * excludes everything inside it.
 *
 * This gate is on selection only. Records already made against a now-excluded element
 * keep applying: switching a rule on is a statement about what you want to edit next,
 * not permission to delete work you already did.
 */
const KEY = 'tweakpage:exclusions';

/**
 * Shipped as an ordinary entry rather than as behaviour, so it can be seen and removed.
 * A convention nobody can find is indistinguishable from a bug in the picker.
 */
export const DEFAULT_EXCLUSIONS = ['[data-tweakpage-ignore]'];

export const MAX_RULES = 50;
const MAX_RULE_LENGTH = 200;

/**
 * A rule matching the whole document leaves nothing on the page selectable, which reads
 * as a broken extension rather than as a rule doing its job. Settings can still be
 * reached to undo it, but there is no reason to let it happen.
 */
const CATCHES_EVERYTHING = new Set(['*', 'html', 'body', ':root']);

export type RuleProblem = 'empty' | 'too long' | 'not a selector' | 'catches everything' | 'already there';

/** Null when the rule is fine; otherwise why it was refused. */
export function ruleProblem(rule: string, existing: string[] = []): RuleProblem | null {
  const trimmed = rule.trim();
  if (trimmed === '') return 'empty';
  if (trimmed.length > MAX_RULE_LENGTH) return 'too long';
  if (CATCHES_EVERYTHING.has(trimmed.toLowerCase())) return 'catches everything';
  try {
    document.querySelector(trimmed);
  } catch {
    return 'not a selector';
  }
  if (existing.includes(trimmed)) return 'already there';
  return null;
}

/**
 * The rule that caught this element, or null.
 *
 * Each rule is tried on its own: one that no longer parses — stored by an older version,
 * or edited by hand — costs its own match and not everyone else's.
 */
export function excludedBy(el: Element, rules: string[]): string | null {
  for (const rule of rules) {
    try {
      if (el.closest(rule)) return rule;
    } catch {
      // A rule that cannot be parsed matches nothing, which is the safe direction: the
      // page stays editable.
    }
  }
  return null;
}

export async function getExclusions(): Promise<string[]> {
  try {
    const stored = (await browser.storage.local.get(KEY))[KEY] as unknown;
    if (!Array.isArray(stored)) return [...DEFAULT_EXCLUSIONS];
    return stored.filter((rule): rule is string => typeof rule === 'string').slice(0, MAX_RULES);
  } catch {
    return [...DEFAULT_EXCLUSIONS];
  }
}

export async function saveExclusions(rules: string[]): Promise<void> {
  try {
    await browser.storage.local.set({ [KEY]: rules.slice(0, MAX_RULES) });
  } catch {
    // Losing a rule costs an element being selectable that you would rather it were not.
  }
}

/**
 * Two pickers follow these rules, and Settings is where they are changed. Without this,
 * a rule added mid-session does nothing until the page is reloaded — which reads as the
 * rule not working. Mirrors watchShareSettings.
 */
export function watchExclusions(onChange: (rules: string[]) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>) => {
    if (!(KEY in changes)) return;
    void getExclusions().then(onChange);
  };
  try {
    browser.storage.local.onChanged.addListener(listener);
  } catch {
    return () => {};
  }
  return () => {
    try {
      browser.storage.local.onChanged.removeListener(listener);
    } catch {
      // context invalidated — the listener went with it
    }
  };
}
