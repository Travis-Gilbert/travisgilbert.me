'use client';

/**
 * CoordinationView (SPEC-9 D5): the human + agent coordination room. Reads the
 * room feed / participants via the shell's room_context command and posts
 * messages via room_post_message.
 */

import { useCallback, useState } from 'react';
import { useApiData } from '@/lib/commonplace-api';
import { roomContext, roomPostMessage } from '@/lib/desktop';
import { DesktopOnly, panel } from './desktopPanel';

const DEFAULT_ROOM = 'room:ungrouped';

export default function CoordinationView() {
  const [roomId, setRoomId] = useState(DEFAULT_ROOM);
  const { data: ctx, error, refetch } = useApiData(() => roomContext(roomId), [roomId]);
  const [draft, setDraft] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const post = useCallback(async () => {
    const message = draft.trim();
    if (!message) return;
    try {
      await roomPostMessage(roomId, message);
      setDraft('');
      setActionError(null);
      refetch();
    } catch (err) {
      setActionError(String(err));
    }
  }, [draft, roomId, refetch]);

  const errorMessage = actionError ?? error?.message ?? null;

  return (
    <DesktopOnly>
      <div style={panel.wrap}>
        <div style={panel.title}>Coordination</div>
        <div style={panel.sub}>
          The human + agent coordination room: feed, participants, and live intents.
        </div>
        <div style={panel.row}>
          <input
            style={panel.input}
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="room id"
          />
          <button style={panel.button} onClick={() => refetch()}>
            Refresh
          </button>
        </div>
        {errorMessage && <div style={{ ...panel.card, color: 'crimson' }}>{errorMessage}</div>}
        <div style={panel.row}>
          <input
            style={panel.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void post();
            }}
            placeholder="message the room..."
          />
          <button style={panel.button} onClick={() => void post()}>
            Post
          </button>
        </div>
        {ctx?.participants?.length ? (
          <div style={panel.dim}>
            Participants: {ctx.participants.map((p) => `${p.actor} (${p.status})`).join(', ')}
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          {(ctx?.feed ?? []).map((item) => (
            <div key={item.id} style={panel.card}>
              <div style={{ fontWeight: 600 }}>{item.actor}</div>
              <div>{item.text}</div>
              {item.createdAt && <div style={panel.dim}>{item.createdAt}</div>}
            </div>
          ))}
          {ctx && ctx.feed.length === 0 && <div style={panel.dim}>No messages yet.</div>}
        </div>
      </div>
    </DesktopOnly>
  );
}
