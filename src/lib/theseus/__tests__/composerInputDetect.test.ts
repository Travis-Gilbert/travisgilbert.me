import { describe, it, expect } from 'vitest';
import { classifyComposerInput } from '../composerInputDetect';

describe('classifyComposerInput', () => {
  it('classifies YouTube watch URL as youtube', () => {
    const result = classifyComposerInput('https://www.youtube.com/watch?v=dQw4w9WgXcQ', null);
    expect(result.kind).toBe('youtube');
  });

  it('classifies short youtu.be URL as youtube', () => {
    const result = classifyComposerInput('https://youtu.be/dQw4w9WgXcQ', null);
    expect(result.kind).toBe('youtube');
  });

  it('classifies generic URL as url', () => {
    const result = classifyComposerInput('https://example.com', null);
    expect(result.kind).toBe('url');
  });

  it('classifies plain text as text', () => {
    const result = classifyComposerInput('what is theseus', null);
    expect(result.kind).toBe('text');
  });

  it('classifies file presence as file', () => {
    const file = new File(['x'], 'paper.pdf', { type: 'application/pdf' });
    const result = classifyComposerInput('', [file]);
    expect(result.kind).toBe('file');
  });
});
