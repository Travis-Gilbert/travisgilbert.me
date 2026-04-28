'use client';

import {
  ActionBarPrimitive,
  ActionBarMorePrimitive,
  AuiIf,
  ErrorPrimitive,
  MessagePrimitive,
  useMessage,
} from '@assistant-ui/react';
import { MarkdownText } from '@/components/assistant-ui/markdown-text';
import { ToolFallback } from '@/components/assistant-ui/tool-fallback';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning';
import { cn } from '@/lib/utils';
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
} from 'lucide-react';
import type { FC } from 'react';
import type { TheseusMessageMetadata } from '@/lib/theseus-assistant-runtime';

const BRAILLE_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];

function StageLabel({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div
      className="aui-stage-label"
      style={{
        marginTop: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--paper-ink-3, #525866)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          marginRight: 8,
          color: 'var(--brass, #c9a23a)',
          display: 'inline-block',
          animation: 'aui-braille-spin 900ms steps(8) infinite',
        }}
      >
        {BRAILLE_FRAMES[0]}
      </span>
      {label}
    </div>
  );
}

/**
 * Assistant-side message. Forked from the Claude-clone composition with
 * Theseus tuning: serif body (Vollkorn) on parchment, a Courier Prime
 * stage label + braille spinner while streaming, and the action bar
 * (copy, refresh, export) that the Claude clone ships with.
 */
const AssistantMessage: FC = () => {
  // reserves space for action bar and compensates with -mb for consistent msg spacing
  const ACTION_BAR_PT = 'pt-1.5';
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="aui-assistant-message fade-in slide-in-from-bottom-1 relative animate-in duration-150"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="wrap-break-word px-2 leading-relaxed"
      >
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            Reasoning,
            ReasoningGroup,
            tools: { Fallback: ToolFallback },
          }}
        />
        <StreamingFooter />
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn('ml-2 flex items-center', ACTION_BAR_HEIGHT)}
      >
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

function StreamingFooter() {
  const metadata = useMessage((m) => m.metadata);
  const custom = (metadata?.custom ?? {}) as Partial<TheseusMessageMetadata>;
  if (!custom.isStreaming) return null;
  return <StageLabel label={custom.stageLabel ?? 'Composing'} />;
}

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root
        className="aui-message-error-root mt-2 rounded-md border p-3 text-sm"
        style={{
          borderColor: 'color-mix(in srgb, var(--color-error) 40%, transparent)',
          background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
          color: 'var(--color-error)',
        }}
      >
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1"
      style={{ color: 'var(--color-ink-muted)' }}
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip="More"
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          className="aui-action-bar-more-content z-50 min-w-32 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
              <DownloadIcon className="size-4" />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

export default AssistantMessage;
