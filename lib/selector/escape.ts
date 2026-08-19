/**
 * A CSS identifier the browser will accept.
 *
 * Hand-rolled, this escaped punctuation but not a leading digit, so an element under
 * `id="123abc"` produced `#123abc` — invalid, silently unusable, and the fallback that
 * should have rescued a drifted record could never run. CSS.escape knows the whole rule;
 * the manual pass is only for environments that lack it.
 */
export function escapeIdent(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/^(\d)/, '\\3$1 ').replace(/([^a-zA-Z0-9_\u00a0-\uffff-])/g, '\\$1');
}
