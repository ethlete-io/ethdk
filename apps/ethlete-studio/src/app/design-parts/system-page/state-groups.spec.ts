import { describe, expect, it } from 'vitest';
import { MANY_STATES, partStateGroupsOf, stateGroupsOf } from './state-groups';

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

describe('partStateGroupsOf', () => {
  const states = (count: number) => Array.from({ length: count }, (_, index) => `s${index % 3}-${index}`);

  it('groups only a part with many states', () => {
    expect(partStateGroupsOf(states(MANY_STATES - 1))).toEqual([]);
    expect(partStateGroupsOf(states(MANY_STATES)).map((group) => group.states.length)).toEqual([4, 4, 4]);
  });
});
