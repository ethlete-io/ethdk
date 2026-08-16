import { describe, expect, it } from 'vitest';
import { adfDocument } from './adf';

describe('adfDocument', () => {
  it('writes one paragraph per line', () => {
    expect(adfDocument('first\nsecond').content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'second' }] },
    ]);
  });

  it('leaves a blank line without a text node, which Jira rejects', () => {
    expect(adfDocument('first\n\nsecond').content[1]).toEqual({ type: 'paragraph' });
  });

  it('is a versioned document, as the v3 API requires', () => {
    expect(adfDocument('x')).toMatchObject({ type: 'doc', version: 1 });
  });
});
