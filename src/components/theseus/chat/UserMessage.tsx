'use client';

import { MessagePrimitive, ActionBarPrimitive } from '@assistant-ui/react';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { UserMessageAttachments } from '@/components/assistant-ui/attachment';
import { PencilIcon } from 'lucide-react';
import type { FC } from 'react';

/**
 * User-side message bubble. Forked from the assistant-ui Claude-clone
 * composition; structure and primitive tree are preserved, styling is
 * tuned to the parchment register via the token aliases in
 * global.css + assistant-ui-theme.css.
 */
const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      data-role="user"
      className="aui-user-message fade-in slide-in-from-bottom-1 grid animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [&:where(>*)]:col-start-2"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word peer rounded-2xl px-4 py-2.5 empty:hidden">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2 peer-empty:hidden">
          <UserActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

export default UserMessage;
