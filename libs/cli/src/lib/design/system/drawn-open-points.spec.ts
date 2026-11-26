import { describe, expect, it } from 'vitest';
import { isPartUndrawn, isStateUndrawn } from './drawn-open-points';
import { RenderIssue } from './render-check';

const issue = (patch: Partial<RenderIssue>): RenderIssue => ({
  rule: 'RENDER',
  product: 'acme',
  part: 'pages/home',
  state: '-',
  size: 'phone',
  path: '#root',
  detail: 'anything',
  sketch: null,
  ...patch,
});

describe('undrawn render issues', () => {
  it('read the flag, not the wording of the detail', () => {
    expect(isStateUndrawn(issue({ state: 'empty', detail: 'reworded', undrawn: 'state' }))).toBe(true);
    expect(isPartUndrawn(issue({ detail: 'reworded', undrawn: 'part' }))).toBe(true);
    expect(isPartUndrawn(issue({ rule: 'RENDER-TIMEOUT', detail: 'reworded', undrawn: 'part' }))).toBe(true);
  });

  it('do not count an issue without the flag, whatever its detail says', () => {
    expect(isStateUndrawn(issue({ state: 'empty', detail: 'design-explore: failed' }))).toBe(false);
    expect(isPartUndrawn(issue({ detail: 'logged SDK error x' }))).toBe(false);
    expect(isPartUndrawn(issue({ detail: 'plain' }))).toBe(false);
  });

  it('keep the two kinds apart', () => {
    expect(isPartUndrawn(issue({ state: 'empty', undrawn: 'state' }))).toBe(false);
    expect(isStateUndrawn(issue({ undrawn: 'part' }))).toBe(false);
  });
});
