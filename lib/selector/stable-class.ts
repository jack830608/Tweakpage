const FRAMEWORK_HASH = /^(css|sc|jss|emotion)[-_]?/i;

export function isStableClass(cls: string): boolean {
  if (cls.length <= 2) return false;
  if (FRAMEWORK_HASH.test(cls)) return false;
  if (/\d{3,}/.test(cls)) return false;
  const hashLike = /^[a-z0-9]+$/i.test(cls) && /\d/.test(cls) && !/[-_]/.test(cls);
  return !hashLike;
}
