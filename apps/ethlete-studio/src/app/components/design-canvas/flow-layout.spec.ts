import { describe, expect, it } from 'vitest';
import { flowColumnsOf } from './flow-layout';

describe('flowColumnsOf', () => {
  it('puts each frame one column after the furthest frame that links to it', () => {
    const columns = flowColumnsOf(
      ['cart', 'done', 'checkout', 'help'],
      [
        { from: 'cart', to: 'checkout' },
        { from: 'checkout', to: 'done' },
        { from: 'cart', to: 'done' },
      ],
    );

    expect(Object.fromEntries(columns)).toEqual({ cart: 0, checkout: 1, done: 2, help: 0 });
  });

  it('ignores a link that closes a cycle and a link to the frame itself', () => {
    const columns = flowColumnsOf(
      ['a', 'b', 'c'],
      [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
        { from: 'b', to: 'b' },
      ],
    );

    expect(Object.fromEntries(columns)).toEqual({ a: 0, b: 1, c: 2 });
  });
});
