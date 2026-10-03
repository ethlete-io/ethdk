import { describe, expect, it } from 'vitest';
import { formatCost } from './stream-format';

describe('formatCost', () => {
  it('writes a cost in its currency', () => {
    expect(formatCost({ currency: 'USD', cost: 12.5, unpriced: [] })).toBe(
      new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(12.5),
    );
  });

  it('names every model that kept the day from a cost', () => {
    expect(
      formatCost({
        currency: 'USD',
        unpriced: [
          { provider: 'claude-code', model: 'opus' },
          { provider: 'codex', model: 'gpt' },
        ],
      }),
    ).toBe('no price for claude-code · opus, codex · gpt');
  });
});
