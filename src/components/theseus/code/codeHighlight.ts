import { createLowlight, common } from 'lowlight';

const lowlight = createLowlight(common);

export interface HighlightToken {
  text: string;
  className: string | null;
}

/**
 * Tokenize a single line of code into highlighted spans.
 * Returns an array of { text, className } where className
 * maps to highlight.js class names (hljs-keyword, hljs-string, etc.)
 */
export function tokenizeLine(line: string, language: string): HighlightToken[] {
  if (!line) return [{ text: '', className: null }];

  try {
    const result = lowlight.highlight(language, line);
    return flattenHast(result.children);
  } catch {
    return [{ text: line, className: null }];
  }
}

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: { className?: string[] };
  children?: HastNode[];
};

function flattenHast(nodes: HastNode[], parentClass: string | null = null): HighlightToken[] {
  const tokens: HighlightToken[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      tokens.push({ text: node.value ?? '', className: parentClass });
    } else if (node.type === 'element' && node.children) {
      const cls = node.properties?.className?.join(' ') ?? parentClass;
      tokens.push(...flattenHast(node.children, cls));
    }
  }

  return tokens;
}

/**
 * Map highlight.js class names to CSS custom properties for
 * the code workshop color scheme.
 */
export function hlClassToColor(className: string | null): string | undefined {
  if (!className) return undefined;

  if (className.includes('keyword') || className.includes('built_in'))
    return 'var(--cw-syn-keyword)';
  if (className.includes('string') || className.includes('regexp'))
    return 'var(--cw-syn-string)';
  if (className.includes('comment') || className.includes('doctag'))
    return 'var(--cw-syn-comment)';
  if (className.includes('function') || className.includes('title.function'))
    return 'var(--cw-syn-function)';
  if (className.includes('title') || className.includes('class') || className.includes('type'))
    return 'var(--cw-syn-class)';
  if (className.includes('number') || className.includes('literal'))
    return 'var(--cw-syn-number)';
  if (className.includes('meta') || className.includes('attr'))
    return 'var(--cw-syn-decorator)';
  if (className.includes('variable') && className.includes('language'))
    return 'var(--cw-syn-self)';
  if (className.includes('operator') || className.includes('punctuation'))
    return 'var(--cw-syn-operator)';

  return undefined;
}
