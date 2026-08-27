import { browser } from 'wxt/browser';
import type { PageEdits } from './edits/types';

/**
 * The running build, read from the manifest so a version is declared in exactly one
 * place — `package.json`, which wxt copies into the manifest at build time.
 *
 * Falls back rather than throwing: a version is useful, not load-bearing, and an
 * export must not fail because the extension context went away mid-hand-off.
 */
export function extensionVersion(): string {
  try {
    return browser.runtime.getManifest()?.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** How the build names itself in a hand-off. */
export function producedBy(): string {
  return `Tweakpage ${extensionVersion()}`;
}

/**
 * Stamps a page with the build that produced it, for anything that leaves the machine.
 *
 * `PageEdits.version` says which *format* the file is in. It does not say which build
 * wrote it, and those are about to stop being the same question: the fix for the
 * structural-edit defects in known-issues.md changes the record format, so exports and
 * share links made now will be opened by versions that read them differently. Which
 * build produced a file cannot be worked out after the fact — by then it is sitting in
 * somebody's Slack.
 *
 * An extra key is safe in both directions: parseImport builds its result from the fields
 * it knows, so a version that has never heard of this one drops it silently.
 */
export function stamped(page: PageEdits): PageEdits & { producedBy: string } {
  return { ...page, producedBy: producedBy() };
}
