'use client';

import { useEffect, useRef, useMemo } from 'react';
import { tokenizeLine, hlClassToColor } from './codeHighlight';
import type { StreamingEdit, AgentId } from './agents';

interface DisplayLine {
  text: string;
  num: number | null;
  type: 'src' | 'ins';
}

interface CodeEditorProps {
  code: string;
  language: string;
  streamingEdits?: StreamingEdit[];
  editProgress?: number;
  activeAgents?: AgentId[];
}

function buildDisplayLines(
  code: string,
  edits: StreamingEdit[],
  progress: number,
): DisplayLine[] {
  const lines = code.split('\n');
  const inserted = edits.slice(0, progress).filter((e) => e.action === 'add');
  const display: DisplayLine[] = [];
  let ii = 0;

  for (let i = 0; i < lines.length; i++) {
    display.push({ text: lines[i], num: i + 1, type: 'src' });
    while (ii < inserted.length && inserted[ii].lineNum === i + 1) {
      display.push({ text: inserted[ii].text, num: null, type: 'ins' });
      ii++;
    }
  }
  while (ii < inserted.length) {
    display.push({ text: inserted[ii].text, num: null, type: 'ins' });
    ii++;
  }

  return display;
}

export default function CodeEditor({
  code,
  language,
  streamingEdits = [],
  editProgress = 0,
  activeAgents = [],
}: CodeEditorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const writerActive = activeAgents.includes('writer');

  const displayLines = useMemo(
    () => buildDisplayLines(code, streamingEdits, editProgress),
    [code, streamingEdits, editProgress],
  );

  // Auto-scroll to latest insertion
  useEffect(() => {
    if (editProgress > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [editProgress]);

  return (
    <div ref={scrollRef} className="cw-editor" role="tabpanel">
      <div className="cw-editor-inner">
        {displayLines.map((dl, i) => {
          const tokens = tokenizeLine(dl.text, language);
          const ins = dl.type === 'ins';
          const isLatestInsert =
            ins &&
            i === displayLines.length - 1 &&
            editProgress < streamingEdits.length &&
            writerActive;

          return (
            <div
              key={`${dl.type}-${dl.num ?? `ins-${i}`}`}
              className={`cw-editor-line${ins ? ' is-insert' : ''}`}
            >
              <span className="cw-editor-gutter" aria-hidden="true">
                {ins ? '+' : dl.num}
              </span>
              <span className="cw-editor-code">
                {tokens.map((t, ti) => {
                  const color = hlClassToColor(t.className);
                  return (
                    <span
                      key={ti}
                      style={color ? { color } : undefined}
                    >
                      {t.text}
                    </span>
                  );
                })}
                {isLatestInsert && (
                  <span className="cw-editor-cursor" />
                )}
              </span>
              {ins && writerActive && (
                <span className="cw-editor-write-dot" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
