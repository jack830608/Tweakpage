import { browser } from 'wxt/browser';

// English is the source of truth and the fallback for contexts without
// chrome.i18n (unit tests, plain DOM). _locales/en is generated from this map.
export const MESSAGES: Record<string, string> = {
  mode_edit: 'Edit',
  mode_browse: 'Browse',
  compare_edited: 'Edited',
  compare_original: 'Original',
  share: 'Share',
  share_copy: 'Copy',
  share_export: 'Export',
  share_snap: 'Snap',
  hide: 'Hide',
  unhide: 'Unhide',
  empty_select: 'Select an element on the page to edit it.',
  empty_hint: 'Switch to Browse to use the page normally. Drag this panel by its title bar.',
  iframe_note: "Editing inside iframes isn't supported.",
  preview_note: 'Viewing the original page — switch back to Edited to continue editing.',
  hidden_note: 'Element is hidden — Unhide to edit it.',
  mixed_warning:
    'This element contains formatted parts — editing text here replaces them with plain text. Use the breadcrumb to edit an inner element instead.',
  footer_changes: '$1 changes · Review ›',
  back_row: '‹ Back to editing',
  onboarding_title: 'Welcome to Tweakpage',
  onboarding_step1: 'Move your mouse over the page and click to select an element.',
  onboarding_step2: 'Switch to Browse to use the page normally (menus, tabs).',
  onboarding_step3: "Drag this panel by its title bar if it's in the way.",
  got_it: 'Got it',
  sec_text: 'Text',
  sec_typography: 'Typography',
  sec_background: 'Background',
  sec_image: 'Image',
  sec_appearance: 'Appearance',
  sec_size: 'Size',
  sec_spacing: 'Spacing',
  apply: 'Apply',
  import_json: 'Import JSON',
  revert_all: 'Revert all',
  no_changes: 'No changes yet.',
  couldnt_apply: "Couldn't apply on this page",
  delete: 'Delete',
  toast_copied: 'Summary copied to clipboard',
  toast_exported: 'JSON exported — check your downloads',
  toast_snapshots: 'Saved before & after snapshots',
  toast_snapshot_failed: 'Snapshot failed',
  toast_import_failed: 'Import failed: $1',
  toast_imported: 'Imported $1 edits$2',
  toast_imported_for: 'Imported $1 edits for $2$3 — open that page to see them',
  toast_skipped: ' ($1 skipped)',
  badge_original: 'Viewing original — Back to edited',
  badge_browsing: 'Browsing — switch to Edit to select',
  pop_edit_this_page: 'Edit this page',
  pop_pages: 'Pages with edits',
  pop_empty: 'No saved edits yet. Open any page and start tweaking.',
  pop_open: 'Open',
  pop_clear: 'Clear',
  confirm_again: "Sure?",
  toast_save_failed: "Couldn't save \u2014 your edits are only on screen. Check storage space.",
  pop_edit: 'Edit',
  pop_applied_here: 'Applied on this page',
  reset_spacing: 'Reset spacing',
  stale_note: 'Tweakpage was updated. Reload the page to keep editing — your saved edits are safe.',
  stale_reload: 'Reload page',
  err_font_family: 'Letters, numbers, spaces and quotes only',
  err_line_height: 'Try 1.5, 24px, or 150%',
  err_number: 'Numbers only',
  err_size: 'Try 320, 50%, auto or fit-content',
  err_image_url: 'Needs to start with https:// — or pick a file',
  stale_edits: '$1 of $2 edits no longer match this page',
};

export function t(key: string, subs?: Array<string | number>): string {
  try {
    // Our keys live in _locales, which the generated union type doesn't know about.
    const getMessage = browser.i18n?.getMessage as
      | ((key: string, subs?: string[]) => string)
      | undefined;
    const message = getMessage?.(key, subs?.map(String));
    if (message) return message;
  } catch {
    // no i18n in this context — fall through to the built-in English table
  }
  let text = MESSAGES[key] ?? key;
  subs?.forEach((sub, index) => {
    text = text.replaceAll(`$${index + 1}`, String(sub));
  });
  return text;
}
