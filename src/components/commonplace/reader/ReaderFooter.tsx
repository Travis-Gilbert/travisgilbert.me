'use client';

/**
 * ReaderFooter: bottom status bar of the reader overlay.
 *
 * Height: 26px. Courier Prime throughout.
 * Left: progress %, paragraph counter, highlight count.
 * Right: keyboard hints (j k, h, t, e).
 */

interface ReaderFooterProps {
  progress: number;
  focusIdx: number;
  totalParagraphs: number;
  highlightCount: number;
}

export default function ReaderFooter({
  progress,
  focusIdx,
  totalParagraphs,
  highlightCount,
}: ReaderFooterProps) {
  return (
    <footer className="reader-footer">
      <div className="reader-footer-left">
        <span>{Math.round(progress)}%</span>
        {totalParagraphs > 0 && (
          <span>
            {focusIdx >= 0 ? focusIdx + 1 : 0}/{totalParagraphs}
          </span>
        )}
        {highlightCount > 0 && (
          <span className="reader-hl-count">
            {highlightCount} highlight{highlightCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="reader-footer-right">
        <span>
          <span className="reader-kbd">j k</span>navigate
        </span>
        <span>
          <span className="reader-kbd">h</span>highlight
        </span>
        <span>
          <span className="reader-kbd">t</span>contents
        </span>
        <span>
          <span className="reader-kbd">e</span>engine
        </span>
      </div>
    </footer>
  );
}
