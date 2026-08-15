export function rgbToHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m = trimmed.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return '#000000';
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

export function pxToNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function isTransparent(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === '' || trimmed === 'transparent') return true;
  const m = trimmed.match(/^rgba\(\s*\d+[,\s]+\d+[,\s]+\d+[,\s/]+([\d.]+)\s*\)$/);
  return m !== null && Number.parseFloat(m[1]) === 0;
}
