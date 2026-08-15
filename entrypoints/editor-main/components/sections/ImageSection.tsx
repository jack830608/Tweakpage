import { useEffect, useMemo, useState } from 'react';
import type { EditsController } from '../../controller';
import { t } from '../../../../lib/i18n';

interface SectionProps {
  element: Element;
  controller: EditsController;
}

export function ImageSection({ element, controller }: SectionProps) {
  const original = useMemo(() => element.getAttribute('src') ?? '', [element]);
  const [url, setUrl] = useState(original);
  useEffect(() => setUrl(element.getAttribute('src') ?? ''), [element]);
  if (element.tagName !== 'IMG') return null;
  return (
    <section className="pgve-section">
      <label>
        {t('label_image_url')}
        <input type="text" aria-label="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <span className="pgve-reset-slot" aria-hidden="true" />
      </label>
      <button
        type="button"
        onClick={() => controller.recordEdit(element, 'attr', 'src', original, url)}
      >
        {t('apply')}
      </button>
    </section>
  );
}
