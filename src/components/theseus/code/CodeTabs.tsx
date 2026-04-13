'use client';

interface CodeTabsProps {
  active: string;
  files: string[];
  onSelect: (path: string) => void;
}

export default function CodeTabs({ active, files, onSelect }: CodeTabsProps) {
  return (
    <div className="cw-tabs" role="tablist" aria-label="Open files">
      {files.map((f) => {
        const name = f.split('/').pop() ?? f;
        const isActive = f === active;
        return (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`cw-tab${isActive ? ' is-active' : ''}`}
            onClick={() => onSelect(f)}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}
