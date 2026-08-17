import { plural, t } from '../i18n';

export const MARKER_HOST_ID = 'tweakpage-marker';

/**
 * Says on the page itself that what you are looking at is not what the site serves.
 *
 * The applier runs whether or not the editor is open, and edits replay silently on every
 * load — so without this, an edited page and the real one are indistinguishable, which
 * matters most for the person you sent a link to. It lives in its own shadow root so the
 * page's CSS cannot restyle or hide it.
 */
export function showMarker(
  doc: Document,
  count: number,
  onOpen: () => void,
  { shared = false, minimized = false }: { shared?: boolean; minimized?: boolean } = {},
): void {
  // A minimized editor keeps its chip even with nothing edited yet — the chip is the
  // only way back in.
  if (count <= 0 && !minimized) {
    removeMarker(doc);
    return;
  }
  const existing = doc.getElementById(MARKER_HOST_ID);
  const host = existing ?? doc.createElement('div');
  if (!existing) {
    host.id = MARKER_HOST_ID;
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = CSS;
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'mark';
    button.addEventListener('click', () => onOpen());
    shadow.append(style, button);
    (doc.body ?? doc.documentElement).appendChild(host);
  }
  const button = host.shadowRoot?.querySelector('button');
  if (!button) return;
  button.title = t(shared ? 'marker_title_shared' : minimized ? 'marker_title_min' : 'marker_title');
  button.textContent = '';
  const text = shared
    ? t('marker_label_shared')
    : count > 0
      ? plural(count, 'marker_label_one', 'marker_label')
      : 'Tweakpage';
  button.append(dot(doc), label(doc, text));
}

export function removeMarker(doc: Document): void {
  doc.getElementById(MARKER_HOST_ID)?.remove();
}

/** Hidden rather than removed, so a screenshot shows the page without it. */
export function setMarkerHidden(doc: Document, hidden: boolean): void {
  const host = doc.getElementById(MARKER_HOST_ID);
  if (host instanceof HTMLElement) host.style.display = hidden ? 'none' : '';
}

function dot(doc: Document): HTMLElement {
  const el = doc.createElement('span');
  el.className = 'dot';
  return el;
}

function label(doc: Document, text: string): HTMLElement {
  const el = doc.createElement('span');
  el.textContent = text;
  return el;
}

const CSS = `
  :host { all: initial; }
  .mark {
    position: fixed; left: 16px; bottom: 16px; z-index: 2147483646;
    display: inline-flex; align-items: center; gap: 7px;
    padding: 7px 13px; border: none; border-radius: 999px;
    background: #18181b; color: #f4f4f5; cursor: pointer;
    font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", system-ui, sans-serif;
    box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.28);
  }
  .mark:hover { background: #27272b; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #059669; flex: none; }
`;
