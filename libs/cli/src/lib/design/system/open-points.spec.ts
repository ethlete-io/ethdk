import { describe, expect, it } from 'vitest';
import { openPointsOf, openPointsText, OpenPointsInput } from './open-points';

const input = (overrides: Partial<OpenPointsInput>): OpenPointsInput => ({
  parts: [],
  comments: [],
  sketches: [],
  ...overrides,
});

const comment = (id: string, part: string, flags: { answered?: boolean; resolved?: boolean } = {}) => ({
  id,
  part,
  state: 'rest',
  answered: flags.answered ?? false,
  resolved: flags.resolved ?? false,
});

describe('openPointsOf', () => {
  it('lists an unlinked part, but not a linked one or a foundation', () => {
    expect(
      openPointsOf(
        input({
          parts: [
            { key: 'components/a', layer: 'components', linked: false, controls: true },
            { key: 'components/b', layer: 'components', linked: true, controls: true },
            { key: 'foundations/c', layer: 'foundations', linked: false, controls: true },
            { key: 'pages/d', layer: 'pages', linked: false, controls: true },
          ],
        }),
      ),
    ).toEqual([
      { part: 'components/a', points: [{ kind: 'unlinked' }] },
      { part: 'pages/d', points: [{ kind: 'unlinked' }] },
    ]);
  });

  it('orders the points by kind: open comment, unmerged sketch, unlinked', () => {
    const [part] = openPointsOf(
      input({
        parts: [{ key: 'components/a', layer: 'components', linked: false, controls: true }],
        sketches: [{ targets: ['components/x', 'components/a'], status: 'ready', decision: null }],
        comments: [comment('c-1', 'components/a')],
      }),
    );

    expect(part?.points.map((point) => point.kind)).toEqual(['open-comment', 'unmerged-sketch', 'unlinked']);
  });

  it('lists a component or element without controls, but not a page or a foundation', () => {
    const parts = (['components', 'elements', 'pages', 'foundations'] as const).map((layer) => ({
      key: `${layer}/a`,
      layer,
      linked: true,
      controls: false,
    }));

    expect(openPointsOf(input({ parts }))).toEqual([
      { part: 'components/a', points: [{ kind: 'missing-state', control: null }] },
      { part: 'elements/a', points: [{ kind: 'missing-state', control: null }] },
    ]);
  });

  it('takes the rendered missing states and contrasts of each part, missing states not on a page', () => {
    expect(
      openPointsOf(
        input({
          parts: [
            { key: 'components/a', layer: 'components', linked: true, controls: true },
            { key: 'pages/b', layer: 'pages', linked: true, controls: true },
          ],
          missingStates: [
            { part: 'components/a', control: 'trigger.hover' },
            { part: 'pages/b', control: 'link.hover' },
          ],
          contrasts: [{ part: 'pages/b', state: 'default', path: 'p' }],
        }),
      ),
    ).toEqual([
      { part: 'components/a', points: [{ kind: 'missing-state', control: 'trigger.hover' }] },
      { part: 'pages/b', points: [{ kind: 'contrast', state: 'default', path: 'p' }] },
    ]);
  });

  it('counts an answered comment until the user resolves it, and only on its own part', () => {
    expect(
      openPointsOf(
        input({
          parts: [{ key: 'components/a', layer: 'components', linked: true, controls: true }],
          comments: [
            comment('answered', 'components/a', { answered: true }),
            comment('resolved', 'components/a', { answered: true, resolved: true }),
            comment('other', 'components/b'),
          ],
        }),
      ),
    ).toEqual([
      { part: 'components/a', points: [{ kind: 'open-comment', comment: 'answered', state: 'rest', answered: true }] },
    ]);
  });
});

describe('openPointsText', () => {
  it('prints none for a product without open points', () => {
    expect(openPointsText('acme', [])).toEqual(['OPEN POINTS acme: none']);
  });

  it('prints the total and one line per part, comments grouped', () => {
    const list = openPointsOf(
      input({
        parts: [
          { key: 'components/a', layer: 'components', linked: false, controls: true },
          { key: 'components/b', layer: 'components', linked: true, controls: true },
        ],
        sketches: [
          { targets: ['components/a'], status: 'in progress', decision: null },
          { targets: ['components/b'], status: 'ready', decision: 'pick' },
        ],
        comments: [comment('c-1', 'components/a'), comment('c-2', 'components/a')],
      }),
    );

    expect(openPointsText('acme', list)).toEqual([
      'OPEN POINTS acme: 5 in 2 parts',
      '  components/a: 2 open comments (c-1, c-2); sketch in progress; no implements',
      '  components/b: sketch picked, not merged',
    ]);
  });

  it('prints missing states and contrasts first', () => {
    const list = openPointsOf(
      input({
        parts: [
          { key: 'components/a', layer: 'components', linked: true, controls: false },
          { key: 'components/b', layer: 'components', linked: true, controls: true },
        ],
        missingStates: [
          { part: 'components/b', control: 'trigger.hover' },
          { part: 'components/b', control: 'menu' },
        ],
        contrasts: [
          { part: 'components/b', state: 'default', path: 'span' },
          { part: 'components/b', state: 'hover', path: 'span' },
        ],
        comments: [comment('c-1', 'components/b')],
      }),
    );

    expect(openPointsText('acme', list)).toEqual([
      'OPEN POINTS acme: 6 in 2 parts',
      '  components/a: no controls declared',
      '  components/b: 2 missing states (trigger.hover, menu); 2 contrasts under the rule (states default, hover); 1 open comment (c-1)',
    ]);
  });
});
