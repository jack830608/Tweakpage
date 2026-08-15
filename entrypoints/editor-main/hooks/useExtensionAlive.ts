import { useEffect, useState } from 'react';
import { isExtensionAlive } from '../../../lib/extension-context';

const POLL_MS = 5000;

// Once the extension reloads/updates, this content script is orphaned and
// edits silently stop persisting. Poll so the UI can tell the user to reload
// instead of letting them keep making doomed edits.
export function useExtensionAlive(): boolean {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    if (!alive) return;
    const id = setInterval(() => {
      if (!isExtensionAlive()) setAlive(false);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [alive]);
  return alive;
}
