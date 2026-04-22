'use client';

import {
  AuiIf,
  ComposerPrimitive,
  MessagePrimitive,
} from '@assistant-ui/react';
import {
  ComposerAttachments,
  ComposerAddAttachment,
} from '@/components/assistant-ui/attachment';
import { Button } from '@/components/ui/button';
import type { FC } from 'react';

/**
 * Atlas Threads composer. Keeps the assistant-ui primitive tree (Root /
 * Input / Send / Cancel) so thread runtime, attachments, and submit
 * wiring are preserved, but styles the chrome as an Atlas paper card
 * via the `.atlas-chat` / `.atlas-chat-*` CSS classes. The paper palette
 * resolves correctly because TheseusThread mounts inside `.ask-paper`.
 */
const ChatComposer: FC = () => {
  return (
    <ComposerPrimitive.Root
      className="atlas-chat"
      style={{ position: 'static', transform: 'none', width: '100%' }}
    >
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div
          data-slot="aui_composer-shell"
          style={{ display: 'contents' }}
        >
          <ComposerAttachments />
          <div className="atlas-chat-input-row">
            <ComposerPrimitive.Input
              placeholder="Ask, think out loud, or @cite a node…"
              className="atlas-chat-input"
              rows={1}
              autoFocus
              aria-label="Message input"
            />
          </div>
          <ComposerAction />
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC = () => {
  return (
    <div className="atlas-chat-tools">
      <ComposerAddAttachment />
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <button
            type="button"
            className="atlas-chat-send"
            aria-label="Send message"
            style={{ marginLeft: 'auto' }}
          >
            Send ↵
          </button>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <button
            type="button"
            className="atlas-chat-send"
            aria-label="Stop generating"
            style={{ marginLeft: 'auto' }}
          >
            Stop
          </button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  );
};

export default ChatComposer;

/**
 * Standalone edit composer for user message edits. Rendered by the
 * Claude-clone thread when `message.composer.isEditing` is true.
 * Keeps the shadcn treatment for the edit surface — different context
 * from the main paper card below the thread.
 */
export const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};
