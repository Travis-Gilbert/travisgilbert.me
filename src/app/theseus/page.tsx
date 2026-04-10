'use client';

import ChatCanvas from '@/components/theseus/chat/ChatCanvas';
import TheseusThread from '@/components/theseus/chat/TheseusThread';
import { useChatHistory } from '@/components/theseus/chat/useChatHistory';

/**
 * Theseus Chat Home: assistant-ui themed conversational interface.
 *
 * When there are no messages, shows a welcome state with the
 * Theseus title, starter queries, and an Explorer link. Once
 * the user asks a question, the threaded conversation fills the space.
 *
 * Uses TheseusThread (which integrates TheseusComposer and TheseusMessage)
 * for markdown rendering, message actions, and follow-up pills.
 */
export default function TheseusHomepage() {
  const { messages, isAsking, ask } = useChatHistory();

  return (
    <div className="theseus-chat-home">
      {/* Canvas texture: subtle shade variations for material feel */}
      <ChatCanvas />

      {/* Unified thread with welcome screen, messages, and composer */}
      <TheseusThread
        messages={messages}
        isAsking={isAsking}
        onSubmit={ask}
      />
    </div>
  );
}
