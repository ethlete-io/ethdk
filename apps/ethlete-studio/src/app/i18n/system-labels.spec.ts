import { describe, expect, it } from 'vitest';
import { TREE_ROW_LABELS } from './system-labels';

describe('TREE_ROW_LABELS', () => {
  it('warns on a sketch row only where the human decides', () => {
    // B695: a warning that only asks the human to pass a job on to the agent is gone.
    expect(Object.keys(TREE_ROW_LABELS.warnings)).toEqual(['changed since ready', 'hold target ended']);
  });
});
