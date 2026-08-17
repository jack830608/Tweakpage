import { useEffect, useState } from 'react';
import { safeSendMessage } from '../../lib/extension-context';
import type { EditsController } from './controller';
import { EditorApp } from './EditorApp';

interface EditorHostProps {
  controller: EditsController;
  host: HTMLElement;
}

export function EditorHost({ controller, host }: EditorHostProps) {
  const [active, setActive] = useState(true);

  useEffect(() => {
    const onToggle = () => setActive((a) => !a);
    const onOpen = () => setActive(true);
    const onDeactivate = () => setActive(false);
    document.addEventListener('tweakpage:toggle', onToggle);
    document.addEventListener('tweakpage:open', onOpen);
    document.addEventListener('tweakpage:deactivate', onDeactivate);
    return () => {
      document.removeEventListener('tweakpage:toggle', onToggle);
      document.removeEventListener('tweakpage:open', onOpen);
      document.removeEventListener('tweakpage:deactivate', onDeactivate);
    };
  }, []);

  useEffect(() => {
    safeSendMessage({ type: 'tweakpage:state', active });
    // The applier owns the corner chip; the editor only reports its state. While
    // active, EditorApp reports open/minimized itself — 'closed' is reported here,
    // carrying the preview's count because a preview exists nowhere the applier can
    // count it.
    if (!active) {
      document.dispatchEvent(
        new CustomEvent('tweakpage:ui', {
          detail: {
            state: 'closed',
            shared: controller.isPreviewingShared(),
            count: controller.getPage().records.filter((r) => r.enabled).length,
          },
        }),
      );
    }
  }, [active, controller]);

  if (!active) return null;
  return <EditorApp controller={controller} host={host} onRequestClose={() => setActive(false)} />;
}
