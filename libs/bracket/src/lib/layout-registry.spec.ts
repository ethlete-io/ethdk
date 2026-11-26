import { describe, expect, it } from 'vitest';
import { resolveBracketLayout } from './layout-registry';

describe('resolveBracketLayout', () => {
  it('returns the first layout registered for a mode', () => {
    const first = { name: 'first', mode: 'single-elimination' as const, value: 1 };
    const second = { name: 'second', mode: 'single-elimination' as const, value: 2 };

    expect(resolveBracketLayout([first, second], 'single-elimination')).toBe(first);
  });

  it('throws the bracket error when no layout matches', () => {
    expect(() => resolveBracketLayout([], 'double-elimination')).toThrow(
      'ET3413: No bracket layout registered for mode "double-elimination". Add doubleEliminationBracketLayout()',
    );
  });
});
