import { describe, expect, it } from 'vitest';
import { MANY_STATES, commentedStatesOf, foldedStatesOf, stateGroupsOf } from './state-groups';

describe('stateGroupsOf', () => {
  it('groups states by their first segment in the order each prefix first appears', () => {
    expect(stateGroupsOf(['comment-mode', 'send-busy', 'comment-draft', 'send-error'])).toEqual([
      { name: 'comment', states: ['comment-mode', 'comment-draft'] },
      { name: 'send', states: ['send-busy', 'send-error'] },
    ]);
  });

  it('puts states whose prefix no other state shares last, under Weitere', () => {
    expect(stateGroupsOf(['part', 'agent-working', 'empty', 'agent-failed', 'listing-error'])).toEqual([
      { name: 'agent', states: ['agent-working', 'agent-failed'] },
      { name: 'Weitere', states: ['part', 'empty', 'listing-error'] },
    ]);
  });

  it('keeps a state without a dash in the group of its name', () => {
    expect(stateGroupsOf(['call', 'call-transferred'])).toEqual([
      { name: 'call', states: ['call', 'call-transferred'] },
    ]);
  });

  it('has no Weitere group when every prefix is shared, and no group without states', () => {
    expect(stateGroupsOf(['a-1', 'a-2']).map((group) => group.name)).toEqual(['a']);
    expect(stateGroupsOf([])).toEqual([]);
  });
});

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
