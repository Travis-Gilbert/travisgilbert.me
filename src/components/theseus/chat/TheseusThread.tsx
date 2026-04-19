'use client';

import {
  AssistantRuntimeProvider,
  AuiIf,
  ThreadPrimitive,
} from '@assistant-ui/react';
import { useTheseusAssistantRuntime } from '@/lib/theseus-assistant-runtime';
import type { ChatMessage as ChatMessageType } from './useChatHistory';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { ArrowDownIcon } from 'lucide-react';
import AskIdleHero from './AskIdleHero';
import ChatComposer from './ChatComposer';
import ChatMessageList from './ChatMessageList';
import type { FC } from 'react';

interface TheseusThreadProps {
  messages: ChatMessageType[];
  isAsking: boolean;
  onSubmit: (query: string) => void;
}

/**
 * Parchment Claude-clone thread. Primitive tree (ThreadPrimitive.Root /
 * Viewport / Messages / ViewportFooter / ComposerPrimitive) from the
 * assistant-ui shadcn registry, Theseus styling + child renderers on top.
 * `useTheseusAssistantRuntime` bridges the existing `useChatHistory`
 * hook to assistant-ui's ExternalStore protocol, so consumer prop shape
 * stays stable.
 */
export default function TheseusThread({
  messages,
  isAsking,
  onSubmit,
}: TheseusThreadProps) {
  const runtime = useTheseusAssistantRuntime({ messages, isAsking, onSubmit });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root
        className="aui-root aui-thread-root @container flex h-full flex-col"
        style={{
          ['--thread-max-width' as string]: '44rem',
          ['--composer-radius' as string]: '18px',
          ['--composer-padding' as string]: '10px',
        }}
      >
        <ThreadPrimitive.Viewport
          turnAnchor="top"
          data-slot="aui_thread-viewport"
          className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
        >
          <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
            <AuiIf condition={(s) => s.thread.isEmpty}>
              <AskIdleHero />
            </AuiIf>

            <ChatMessageList />

            <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible rounded-t-(--composer-radius) pb-4 md:pb-6">
              <ThreadScrollToBottom />
              <ChatComposer />
            </ThreadPrimitive.ViewportFooter>
          </div>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

/**
 * Markdown export helper. AskPanel's download button calls this after
 * confirming there's at least one message. Preserved from the previous
 * TheseusThread to keep AskPanel's import path stable.
 */
export function exportChatAsMarkdown(messages: ChatMessageType[]) {
  const lines: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'user') lines.push(`## User\n\n${msg.text}\n`);
    else lines.push(`## Theseus\n\n${msg.text}\n`);
  }
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `theseus-chat-${new Date().toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
