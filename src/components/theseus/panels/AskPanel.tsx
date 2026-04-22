'use client';

import { useCallback, useState } from 'react';
import { exportChatAsMarkdown } from '@/components/theseus/chat/TheseusThread';
import { useChatHistory } from '@/components/theseus/chat/useChatHistory';
import AtlasThreadsSurface from '@/components/theseus/atlas/threads/AtlasThreadsSurface';
import AtlasFolioThread from '@/components/theseus/atlas/threads/AtlasFolioThread';

/**
 * Atlas Threads panel.
 *
 * Paper surface hosting a full Atlas folio thread. Chat state lives in
 * `useChatHistory` and is mapped to folios by AtlasFolioThread; the
 * surrounding chrome (Export strip, folio rail, reply composer) comes
 * from AtlasThreadsSurface + AtlasFolioThread together.
 */
export default function AskPanel() {
  const { messages, isAsking, ask } = useChatHistory();
  const [activeFolio, setActiveFolio] = useState(0);

  const handleExport = useCallback(() => {
    if (messages.length > 0) exportChatAsMarkdown(messages);
  }, [messages]);

  const handleJumpToFolio = useCallback((index: number) => {
    setActiveFolio(index);
    const turns = messages.filter((m) => m.role === 'user');
    const target = turns[index];
    if (!target) return;
    const el = document.getElementById(`atlas-folio-${target.id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [messages]);

  return (
    <AtlasThreadsSurface
      messages={messages}
      onExport={handleExport}
      activeFolio={activeFolio}
      onJumpToFolio={handleJumpToFolio}
    >
      <AtlasFolioThread
        messages={messages}
        isAsking={isAsking}
        onSubmit={ask}
        onActiveFolioChange={setActiveFolio}
      />
    </AtlasThreadsSurface>
  );
}
