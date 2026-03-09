'use client';

import { useState, useEffect } from 'react';
import { Command } from 'cmdk';
import {
  type StudioCommand,
  STUDIO_COMMANDS,
} from '@/lib/studio-commands';

const CATEGORY_LABELS: Record<string, string> = {
  editor: 'Editor',
  view: 'View',
  navigate: 'Navigate',
  content: 'Content',
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExecute: (commandId: string) => void;
  isEditorActive: boolean;
}

/**
 * Cmd+K command palette built on cmdk.
 * Fuzzy search, keyboard navigation, and Radix Dialog
 * accessibility are all handled by the library.
 *
 * Portals into the .studio-theme container so CSS custom
 * properties (--studio-*) resolve in both dark and light mode.
 */
export default function CommandPalette({
  open,
  onOpenChange,
  onExecute,
  isEditorActive,
}: CommandPaletteProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(document.querySelector('.studio-theme') as HTMLElement);
  }, []);

  const commands = isEditorActive
    ? STUDIO_COMMANDS
    : STUDIO_COMMANDS.filter((c) => !c.editorOnly);

  /* Group by category (preserving command order) */
  const groups: Record<string, StudioCommand[]> = {};
  for (const cmd of commands) {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      container={container ?? undefined}
    >
      <Command.Input placeholder="Type a command..." />
      <Command.List>
        <Command.Empty>No commands found</Command.Empty>

        {Object.entries(groups).map(([category, cmds]) => (
          <Command.Group
            key={category}
            heading={CATEGORY_LABELS[category] ?? category}
          >
            {cmds.map((cmd) => (
              <Command.Item
                key={cmd.id}
                value={`${cmd.label} ${cmd.description ?? ''}`}
                onSelect={() => {
                  onExecute(cmd.id);
                  onOpenChange(false);
                }}
              >
                <div>
                  <div className="studio-cmdk-label">{cmd.label}</div>
                  {cmd.description && (
                    <div className="studio-cmdk-desc">{cmd.description}</div>
                  )}
                </div>

                {cmd.shortcut && (
                  <span className="studio-cmdk-shortcut">{cmd.shortcut}</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        ))}
      </Command.List>

      <div className="studio-cmdk-footer">
        <span>arrows navigate</span>
        <span>enter select</span>
        <span>esc close</span>
      </div>
    </Command.Dialog>
  );
}
