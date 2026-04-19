// Font constants for pretext text-measurement. Pretext's prepare() accepts a
// CSS font shorthand string and measures widths against the browser canvas;
// those strings MUST match the actual rendered fonts or pretext returns
// wrong heights. Keep these in sync with the parchment register in
// src/styles/theseus.css and global.css.

export const PROSE_FONT = '15px "Vollkorn", Georgia, serif';
export const PROSE_FONT_ITALIC = 'italic 15px "Vollkorn", Georgia, serif';
export const MONO_FONT = '11px "Courier Prime", "Courier New", monospace';
export const CODE_FONT = '13px "JetBrains Mono", monospace';
export const LABEL_FONT = '10px "Courier Prime", "Courier New", monospace';

export const PROSE_LINE_HEIGHT = 24;
export const MONO_LINE_HEIGHT = 16;
export const LABEL_LINE_HEIGHT = 14;
