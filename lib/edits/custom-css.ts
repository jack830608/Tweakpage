/**
 * The escape hatch: CSS the panel has no field for.
 *
 * Declarations typed here become ordinary style records — one per property — so each
 * shows up in Review, toggles, resets and exports like anything the panel wrote. The
 * same rules gate typing and importing: the panel is friendly parsing, the import is
 * the trust boundary, and they must not drift apart.
 */

/** A property name as CSS spells it. Vendor prefixes allowed; custom properties not. */
const PROPERTY = /^-?[a-z][a-z-]{0,40}$/;

/**
 * No blocks, no nested rules, no import tricks — and no second declaration.
 *
 * A semicolon was missing from this list, and the two paths this file claims to hold to
 * one rule had drifted because of it: typing can never produce a value containing one,
 * since parseDeclarations splits on it first, but an imported record could. One record
 * then owned the whole rule, and a shared link could paint a full-viewport opaque
 * overlay at the top z-index over whatever page it was opened on.
 */
const FORBIDDEN = /[{}<>;]|@|\/\*|javascript:|vbscript:|expression\s*\(|attr\s*\(|element\s*\(/i;

/**
 * A value may fetch, but only from where a picture can legitimately come from.
 *
 * url() was unrestricted here while the panel's own background-image field has always
 * been held to http(s) or an inline image. cursor, mask-image and list-style-image all
 * take url() too, so the looser rule reached further than the field that was checked.
 */
const URL_CALL = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
const ALLOWED_TARGET = /^(https:\/\/|http:\/\/|data:image\/|\/)/i;
const MAX_VALUE = 500;

export function isCustomProperty(name: string): boolean {
  return PROPERTY.test(name);
}

export function isSafeCustomValue(value: string): boolean {
  if (value.length === 0 || value.length > MAX_VALUE) return false;
  if (FORBIDDEN.test(value)) return false;
  const targets = [...value.matchAll(URL_CALL)];
  // Something that opens a url( we could not parse closed is not a value we understand.
  if (/\burl\s*\(/i.test(value) && targets.length === 0) return false;
  return targets.every(([, , target]) => ALLOWED_TARGET.test(target.trim()));
}

export type ParsedDeclarations =
  | { ok: true; declarations: Array<{ property: string; value: string }> }
  | { ok: false; error: string };

/** Parses "prop: value; prop: value" the way a human writes it, or says what's wrong. */
export function parseDeclarations(text: string): ParsedDeclarations {
  const declarations: Array<{ property: string; value: string }> = [];
  for (const chunk of text.split(';')) {
    const line = chunk.trim();
    if (line === '') continue;
    const colon = line.indexOf(':');
    if (colon === -1) return { ok: false, error: line };
    const property = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (!isCustomProperty(property) || !isSafeCustomValue(value)) {
      return { ok: false, error: line };
    }
    declarations.push({ property, value });
  }
  return { ok: true, declarations };
}
