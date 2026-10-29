/**
 * Same-browser synchronisation: when one tab commits a change, other open HomeHub tabs reload
 * the affected data. This is not cross-device sync — local mode keeps data in this browser only.
 */
type SyncMessage = { kind: 'household'; householdId: string } | { kind: 'global' };

const CHANNEL_NAME = 'homehub-sync';

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  channel ??= new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastChange(message: SyncMessage): void {
  try {
    getChannel()?.postMessage(message);
  } catch {
    // Broadcasting is best-effort; the local tab already has the change.
  }
}

export function subscribeToChanges(listener: (message: SyncMessage) => void): () => void {
  const current = getChannel();
  if (!current) return () => undefined;
  const handler = (event: MessageEvent<SyncMessage>) => listener(event.data);
  current.addEventListener('message', handler);
  return () => current.removeEventListener('message', handler);
}
