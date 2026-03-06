'use client';

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

const LANGUAGES = [
  { value: '', label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'bash', label: 'Bash' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
];

export default function CodeBlockNode({
  node,
  updateAttributes,
}: NodeViewProps) {
  const language = node.attrs.language || '';

  return (
    <NodeViewWrapper className="studio-code-block-wrapper">
      <div className="studio-code-block-header" contentEditable={false}>
        <select
          className="studio-code-block-lang"
          value={language}
          onChange={(e) => updateAttributes({ language: e.target.value })}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="studio-code-block-copy"
          onClick={() => {
            const text = node.textContent;
            navigator.clipboard.writeText(text);
          }}
        >
          Copy
        </button>
      </div>
      <pre>
        <code>
          <NodeViewContent />
        </code>
      </pre>
    </NodeViewWrapper>
  );
}
