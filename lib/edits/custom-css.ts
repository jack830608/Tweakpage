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

/** No blocks, no nested rules, no import tricks — values only. */
const FORBIDDEN = /[{}<>]|@|\/\*|javascript:|expression\s*\(/i;
const MAX_VALUE = 500;

export function isCustomProperty(name: string): boolean {
  return PROPERTY.test(name);
}

export function isSafeCustomValue(value: string): boolean {
  return value.length > 0 && value.length <= MAX_VALUE && !FORBIDDEN.test(value);
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
