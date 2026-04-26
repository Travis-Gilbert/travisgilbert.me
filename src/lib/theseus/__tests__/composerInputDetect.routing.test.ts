import { describe, it, expect } from 'vitest';
import { classifyComposerInput } from '../composerInputDetect';

describe('routing fork: text still routes to /ask/', () => {
  it('plain question routes to text', () => {
    expect(classifyComposerInput('what is theseus', null).kind).toBe('text');
  });
  it('multi-word with embedded url phrase routes to text', () => {
    expect(classifyComposerInput('look at https://example.com later', null).kind).toBe('text');
  });
});
