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
