/**
 * A request that is allowed to fail, but not to hang.
 *
 * None of the calls in this extension had a timeout. A stalled upload spun its button
 * for as long as the network cared to keep the socket open — and when Chrome eventually
 * killed the service worker, the user was told to check credentials that were fine. A
 * request that is going to fail should fail while somebody is still watching it.
 */
const DEFAULT_MS = 20000;

export async function fetchWithin(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = DEFAULT_MS,
): Promise<Response> {
  // AbortSignal.timeout is not in every runtime the tests run under.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
