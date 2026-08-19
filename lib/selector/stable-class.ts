export function isStableClass(cls: string): boolean {
  if (cls.length <= 2) return false;
  if (/^(css-|sc-|jss\d|emotion-)/i.test(cls)) return false;
  if (/\d{3,}/.test(cls)) return false;
  const modulesTail = cls.split('__').pop();
  if (cls.includes('__') && modulesTail && /^[a-z0-9]{4,}$/i.test(modulesTail) && /\d/.test(modulesTail)) {
    return false;
  }
  const bareTail = cls.match(/^_+([a-z0-9]{4,})$/i);
  if (bareTail && /\d/.test(bareTail[1])) return false;
  if (!/[-_]/.test(cls) && /\d/.test(cls)) {
    const digitCount = (cls.match(/\d/g) ?? []).length;
    const mixedCase = /[a-z]/.test(cls) && /[A-Z]/.test(cls);
    if (digitCount >= 2 || mixedCase) return false;
  }
  return true;
}

/**
 * The part of a class name a developer typed, or null if none of it was.
 *
 * CSS Modules emit `<file>_<localName>__<hash>`. The hash changes on any build that
 * touches the file, but everything in front of it is the author's — `rg optIn` finds the
 * component that renders this element, which is the question somebody reading a hand-off
 * is actually asking. styled-components and emotion emit nothing but a hash, so there is
 * nothing to keep. Tailwind utilities are written verbatim in the source and survive
 * whole.
 *
 * Distinct from isStableClass, which decides what may go into a selector. This decides
 * what is worth telling a human, and keeps things a selector should never rely on.
 */
export function sourceClassName(cls: string): string | null {
  if (cls.length < 2 || cls.length > 60) return null;
  if (/^(css-|sc-|jss\d|emotion-)/i.test(cls)) return null;
  const cut = cls.lastIndexOf('__');
  if (cut > 0) {
    const tail = cls.slice(cut + 2);
    // A CSS Modules hash: short, alphanumeric, carrying a digit. A BEM element name
    // ("card__title") carries none, and keeps all of itself.
    if (/^[a-z0-9]{4,}$/i.test(tail) && /\d/.test(tail)) return cls.slice(0, cut);
  }
  // A hash with nothing authored in front of it says nothing about the source.
  if (/^_+[a-z0-9]{4,}$/i.test(cls) && /\d/.test(cls)) return null;
  return cls;
}
