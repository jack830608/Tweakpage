/**
 * A token the page cannot guess.
 *
 * The applier and the editor are separate bundles sharing one document, so they talk
 * over DOM events — which any script on the page can dispatch too. That is harmless for
 * events that only move UI around, and not harmless for the one that rewrites what a
 * reset will restore. Those carry this token, minted once per page in the content
 * script's isolated world and never written into the DOM.
 */
const token = crypto.randomUUID();

export function sign<T extends object>(detail: T): T & { token: string } {
  return { ...detail, token };
}

/** True when this really came from our own code rather than from the page. */
export function isOurs(detail: unknown): boolean {
  return typeof detail === 'object' && detail !== null && (detail as { token?: string }).token === token;
}
