/**
 * Colours keep their alpha as an 8-digit hex.
 *
 * Reading rgba(0, 0, 0, .5) back as #000000 meant the field showed an opaque colour and
 * the first edit silently threw the transparency away — and translucent overlays are
 * most of what a landing page's colours are.
 */
export function rgbToHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m = trimmed.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/i);
  if (!m) return '#000000';
  const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const base = `#${hex(Number(m[1]))}${hex(Number(m[2]))}${hex(Number(m[3]))}`;
  const alpha = m[4] === undefined ? 1 : Number(m[4]);
  return alpha >= 1 ? base : `${base}${hex(alpha * 255)}`;
}

/** The <input type="color"> widget only understands 6-digit hex. */
export function hexWithoutAlpha(hex: string): string {
  return /^#[0-9a-f]{8}$/i.test(hex) ? hex.slice(0, 7) : hex;
}

/** 0–100, for the alpha slider beside a colour. */
export function alphaPercent(hex: string): number {
  if (!/^#[0-9a-f]{8}$/i.test(hex)) return 100;
  return Math.round((Number.parseInt(hex.slice(7), 16) / 255) * 100);
}

export function withAlphaPercent(hex: string, percent: number): string {
  const base = hexWithoutAlpha(hex);
  if (percent >= 100) return base;
  const value = Math.round((Math.max(0, percent) / 100) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${base}${value}`;
}

export function pxToNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Unit-stripped value for a number input — keeps decimals that px rounding would eat. */
export function pxToDisplay(value: string): string {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? String(n) : '0';
}

export function isTransparent(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'transparent') return true;
  const m = trimmed.match(/^rgba\(\s*\d+[,\s]+\d+[,\s]+\d+[,\s/]+([\d.]+)\s*\)$/);
  return m !== null && Number.parseFloat(m[1]) === 0;
}

/** True when a field's value is a number on its own, with no unit or keyword. */
export function isBareNumber(value: string): boolean {
  return /^-?\d*\.?\d+$/.test(value.trim());
}
