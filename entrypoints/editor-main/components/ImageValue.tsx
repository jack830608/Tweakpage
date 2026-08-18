import { t } from '../../../lib/i18n';

/**
 * An image value, shown as what it is.
 *
 * A picked file lives in the record as base64 — hundreds of kilobytes of it. Printed
 * into a text input it is an unreadable wall; left out, the field looks empty and the
 * edit looks lost. So a picked file gets its own presentation: the picture itself, its
 * type and its size. Typing a URL is still how you point at one on the web, and the
 * reset beside the field name is how you go back to what the site serves.
 */
const EMBEDDED = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/;

/** The data: URL inside a value, whether it stands alone or sits inside url(). */
export function embeddedIn(value: string): string | null {
  return value.match(EMBEDDED)?.[0] ?? null;
}

export function PickedImage({ dataUrl, testId }: { dataUrl: string; testId: string }) {
  const mediaType = dataUrl.slice('data:'.length, dataUrl.indexOf(';'));
  const kb = Math.max(1, Math.round((dataUrl.length * 3) / 4 / 1024));
  return (
    <div className="twk-picked" data-testid={testId} title={t('image_embedded', [mediaType, String(kb)])}>
      <img src={dataUrl} alt="" />
      <span>
        <strong>{t('image_picked')}</strong>
        {mediaType.slice('image/'.length)} · {kb} KB
      </span>
    </div>
  );
}
