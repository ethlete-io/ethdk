import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { MAX_UNGROUPED_STATES, stateGroupProblemsOf } from './state-groups';

const productOf = (source: string, origin = 'product') =>
  ({ parts: [{ file: '/p/part.ts', origin, source }] }) as unknown as ResolvedProduct;

const namesOf = (count: number) => Array.from({ length: count }, (_, index) => `s${index}`);

const partWith = (states: string[], groups = '') => `import { definePart } from '@design-system';
export default definePart({
  note: '',
  states: { ${states.map((state) => `'${state}': {}`).join(', ')} },
  ${groups}
  render: () => ({ body: '', styles: '' }),
});
`;

const messagesOf = (product: ResolvedProduct) =>
  stateGroupProblemsOf(product).map((problem) => `${problem.rule} ${problem.message}`);

describe('stateGroupProblemsOf', () => {
  it('passes a part with few states and no groups', () => {
    expect(messagesOf(productOf(partWith(namesOf(MAX_UNGROUPED_STATES))))).toEqual([]);
  });

  // A part with many states and no state groups is a design check finding.
  it('names a part with many states and no groups', () => {
    expect(messagesOf(productOf(partWith(namesOf(MAX_UNGROUPED_STATES + 1))))).toEqual([
      expect.stringMatching(/^STATE-GROUPS 13 states and no groups/u),
    ]);
  });

  it('leaves a base part to its own product', () => {
    expect(messagesOf(productOf(partWith(namesOf(MAX_UNGROUPED_STATES + 1)), 'base'))).toEqual([]);
  });

  it('passes a part whose groups hold every state once', () => {
    const groups = "groups: [{ label: 'A', states: ['s0', 's1'] }, { label: 'B', states: ['s2'] }],";

    expect(messagesOf(productOf(partWith(namesOf(3), groups)))).toEqual([]);
  });

  it('names a state in no group, in two groups, and a group state the part does not have', () => {
    const groups = "groups: [{ label: 'A', states: ['s0', 's1'] }, { label: 'B', states: ['s1', 'gone'] }],";
    const problems = stateGroupProblemsOf(productOf(partWith(namesOf(3), groups)));

    expect(problems.map((problem) => [problem.message, problem.states])).toEqual([
      ['state in no group: s2', ['s2']],
      ['state in more than one group: s1', ['s1']],
      ['group names a state the part does not have: gone', undefined],
    ]);
  });

  it('passes groups it cannot read without running the part', () => {
    expect(messagesOf(productOf(partWith(namesOf(MAX_UNGROUPED_STATES + 1), 'groups: GROUPS,')))).toEqual([]);
  });
});
