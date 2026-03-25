'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  type StudioCommand,
  STUDIO_COMMANDS,
} from '@/lib/studio-commands';
import { searchContent, type ContentSearchResult } from '@/lib/studio-api';
import { getContentTypeIdentity } from '@/lib/studio';

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
 *
 * Includes debounced content search: type 2+ chars to search
 * across all Studio content items alongside static commands.
 */
export default function CommandPalette({
  open,
  onOpenChange,
  onExecute,
  isEditorActive,
}: CommandPaletteProps) {
  const router = useRouter();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [searchResults, setSearchResults] = useState<ContentSearchResult[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setContainer(document.querySelector('.studio-theme') as HTMLElement);
  }, []);

  /* Clear search results when palette closes */
  useEffect(() => {
    if (!open) setSearchResults([]);
  }, [open]);

  const commands = isEditorActive
    ? STUDIO_COMMANDS
    : STUDIO_COMMANDS.filter((c) => !c.editorOnly);

  /* Group by category (preserving command order) */
  const groups: Record<string, StudioCommand[]> = {};
  for (const cmd of commands) {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  }

  /* Debounced content search on input change */
  const handleValueChange = useCallback((value: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchContent(value);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 200);
  }, []);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      container={container ?? undefined}
    >
      <Command.Input
        placeholder="Search or type a command..."
        onValueChange={handleValueChange}
      />
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

        {searchResults.length > 0 && (
          <Command.Group heading="Content">
            {searchResults.map((result) => (
              <Command.Item
                key={result.id}
                value={`content:${result.label}`}
                onSelect={() => {
                  router.push(`/studio/${getContentTypeIdentity(result.contentType).route}/${result.slug}`);
                  onOpenChange(false);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: getContentTypeIdentity(result.contentType).color,
                    flexShrink: 0,
                  }} />
                  <div>
                    <div className="studio-cmdk-label">{result.label}</div>
                    <div className="studio-cmdk-desc">{getContentTypeIdentity(result.contentType).label}</div>
                  </div>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>

      <div className="studio-cmdk-footer">
        <span>arrows navigate</span>
        <span>enter select</span>
        <span>esc close</span>
      </div>
    </Command.Dialog>
  );
}
