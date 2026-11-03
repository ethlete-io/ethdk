import { describe, expect, it } from 'vitest';
import { withLoopMotionHint } from './loop-motion-hint';

describe('withLoopMotionHint', () => {
  it('names the exact motions entry to add', () => {
    expect(withLoopMotionHint('components/b: no looping motion in loading')).toBe(
      "components/b: no looping motion in loading (add to motions: loading: { from: 'loading', to: 'loading' })",
    );
  });

  it('gives one entry per state and leaves the rest of the line', () => {
    expect(withLoopMotionHint('x: no looping motion in a, b; 1 open comment')).toBe(
      "x: no looping motion in a, b (add to motions: a: { from: 'a', to: 'a' }, b: { from: 'b', to: 'b' }); 1 open comment",
    );
  });

  it('leaves a line without the refusal alone', () => {
    expect(withLoopMotionHint('x: 2 missing motions')).toBe('x: 2 missing motions');
  });
});
