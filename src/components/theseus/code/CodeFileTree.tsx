'use client';

import type { CodeFile } from './agents';

interface CodeFileTreeProps {
  files: CodeFile[];
  activeFile: string;
  onSelect: (path: string) => void;
}

export default function CodeFileTree({ files, activeFile, onSelect }: CodeFileTreeProps) {
  return (
    <div className="cw-file-tree">
      <div className="cw-file-tree-header">Files</div>

      <div className="cw-file-tree-list">
        {files.map((f) => {
          const parts = f.path.split('/');
          const name = parts.pop() ?? f.path;
          const dir = parts[parts.length - 1] ?? '';
          const active = f.path === activeFile;

          return (
            <button
              key={f.path}
              type="button"
              className={`cw-file-tree-item${active ? ' is-active' : ''}`}
              onClick={() => onSelect(f.path)}
            >
              <span className="cw-file-tree-name">{name}</span>
              <span className="cw-file-tree-dir">{dir}/</span>
            </button>
          );
        })}
      </div>

      <div className="cw-file-tree-stats">
        <span className="cw-file-tree-stat-count">21</span> sym &middot;{' '}
        <span className="cw-file-tree-stat-clusters">5</span> clusters
      </div>
    </div>
  );
}
