import { describe, expect, it } from 'vitest';
import { tokenSheet } from '../../../design/token-sheet';

describe('tokenSheet', () => {
  const { styles } = tokenSheet({ title: 't', css: '', sample: '', sampleOf: () => '' });

  it('gives every custom property in its own styles a fallback, so products without Studio tokens still draw', () => {
    const bare = [...styles.matchAll(/var\(--[a-z0-9-]+\)/g)].map((match) => match[0]);

    expect(bare).toEqual([]);
    expect(styles).toContain('var(--space-4, 1.6rem)');
  });
});
