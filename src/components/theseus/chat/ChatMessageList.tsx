'use client';

import { ThreadPrimitive, useAuiState } from '@assistant-ui/react';
import UserMessage from './UserMessage';
import AssistantMessage from './AssistantMessage';
import { EditComposer } from './ChatComposer';
import type { FC } from 'react';

/**
 * Message list renderer. Delegates iteration to ThreadPrimitive.Messages
 * (the primitive owns focus management, auto-scroll pinning, and
 * virtualisation decisions); this component only maps role → concrete
 * message component.
 */
const ChatMessageList: FC = () => {
  return (
    <div
      data-slot="aui_message-group"
      className="mb-10 flex flex-col gap-y-8 empty:hidden"
    >
      <ThreadPrimitive.Messages>
        {() => <ThreadMessage />}
      </ThreadPrimitive.Messages>
    </div>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);
  if (isEditing) return <EditComposer />;
  if (role === 'user') return <UserMessage />;
  return <AssistantMessage />;
};

export default ChatMessageList;
