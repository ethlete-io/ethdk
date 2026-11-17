import { describe, expect, it } from 'vitest';
import { MANY_STATES, commentedStatesOf, foldedStatesOf } from './folded-states';

describe('foldedStatesOf', () => {
  const states = Array.from({ length: MANY_STATES }, (_, index) => `not-${index}`);

  it('folds every state of a part with many states that needs no look', () => {
    expect([...foldedStatesOf(states, new Set(['not-3', 'gone']))]).toEqual(
      states.filter((state) => state !== 'not-3'),
    );
  });

  it('folds nothing in a part with few states, or when no state or every state needs a look', () => {
    expect(foldedStatesOf(states.slice(1), new Set(['not-3'])).size).toBe(0);
    expect(foldedStatesOf(states, new Set()).size).toBe(0);
    expect(foldedStatesOf(states, new Set(states)).size).toBe(0);
  });
});

describe('commentedStatesOf', () => {
  it('names the states of the part that hold a comment outside a sketch', () => {
    const comments = [
      { part: 'pages/system', state: 'empty' },
      { part: 'pages/system', state: 'empty' },
      { part: 'pages/system', state: 'busy', sketch: { target: 'pages/system', variant: 'a' } },
      { part: 'pages/inbox', state: 'error' },
    ];

    expect([...commentedStatesOf(comments, 'pages/system')]).toEqual(['empty']);
  });
});
