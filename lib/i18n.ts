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
  label_font_family: 'Font family',
  label_font_size: 'Font size',
  label_font_weight: 'Font weight',
  label_line_height: 'Line height',
  label_text_align: 'Text align',
  label_letter_spacing: 'Letter spacing',
  label_text_transform: 'Text transform',
  label_color: 'Color',
  label_bg_color: 'Background color',
  label_bg_image: 'Background image URL',
  label_image_url: 'Image URL',
  label_corner_radius: 'Corner radius',
  label_opacity: 'Opacity',
  label_border_width: 'Border width',
  label_border_color: 'Border color',
  label_width: 'Width',
  label_height: 'Height',
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
};

export function t(key: string, subs?: Array<string | number>): string {
  try {
    const message = browser.i18n?.getMessage?.(key, subs?.map(String));
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
