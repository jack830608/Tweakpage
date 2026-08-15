import { useEffect, useMemo, useState } from 'react';
import type { EditsController } from '../../controller';

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
      <h3>Image</h3>
      <label>
        Image URL
        <input type="text" aria-label="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
      <button
        type="button"
        onClick={() => controller.recordEdit(element, 'attr', 'src', original, url)}
      >
        Apply
      </button>
    </section>
  );
}
