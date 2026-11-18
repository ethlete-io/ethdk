import { describe, expect, it } from 'vitest';
import { OPEN_POINT_KINDS, openPointsOf, openPointsText, OpenPointsInput, sketchAddedPointsOf } from './open-points';

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
  it('lists no open point for a part with controls, linked or not, and has no go kinds', () => {
    expect(OPEN_POINT_KINDS).not.toContain('no-go');
    expect(OPEN_POINT_KINDS).not.toContain('stale-go');

    expect(
      openPointsOf(
        input({
          parts: [
            { key: 'components/a', layer: 'components', controls: true },
            { key: 'components/b', layer: 'components', controls: true },
            { key: 'foundations/c', layer: 'foundations', controls: true },
            { key: 'pages/d', layer: 'pages', controls: true },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('orders the points by kind: open comment, unmerged sketch', () => {
    const [part] = openPointsOf(
      input({
        parts: [{ key: 'components/a', layer: 'components', controls: true }],
        sketches: [
          {
            name: 'components-x',
            target: 'components/x',
            targets: ['components/x', 'components/a'],
            status: 'ready',
            decision: null,
          },
        ],
        comments: [comment('c-1', 'components/a')],
      }),
    );

    expect(part?.points.map((point) => point.kind)).toEqual(['open-comment', 'unmerged-sketch']);
  });

  it('lists a component or element without controls, but not a page or a foundation', () => {
    const parts = (['components', 'elements', 'pages', 'foundations'] as const).map((layer) => ({
      key: `${layer}/a`,
      layer,

      controls: false,
    }));

    expect(openPointsOf(input({ parts }))).toEqual([
      { part: 'components/a', points: [{ kind: 'missing-state', control: null }] },
      { part: 'elements/a', points: [{ kind: 'missing-state', control: null }] },
    ]);
  });

  it('skips the no controls point for a part that declares an empty controls, not one without the key', () => {
    const part = (key: string, declaredNoControls?: boolean) => ({
      key,
      layer: 'components' as const,

      controls: false,
      declaredNoControls,
    });

    expect(
      openPointsOf(input({ parts: [part('components/a', true), part('components/b', false), part('components/c')] })),
    ).toEqual([
      { part: 'components/b', points: [{ kind: 'missing-state', control: null }] },
      { part: 'components/c', points: [{ kind: 'missing-state', control: null }] },
    ]);
  });

  it('takes the rendered missing states of each part, missing states not on a page', () => {
    expect(
      openPointsOf(
        input({
          parts: [
            { key: 'components/a', layer: 'components', controls: true },
            { key: 'pages/b', layer: 'pages', controls: true },
          ],
          missingStates: [
            { part: 'components/a', control: 'trigger.hover' },
            { part: 'pages/b', control: 'link.hover' },
          ],
        }),
      ),
    ).toEqual([{ part: 'components/a', points: [{ kind: 'missing-state', control: 'trigger.hover' }] }]);
  });

  it('counts an answered comment until the user resolves it, and only on its own part', () => {
    expect(
      openPointsOf(
        input({
          parts: [{ key: 'components/a', layer: 'components', controls: true }],
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
  it('asks a motion for every ordered pair and a loop in an ongoing-work state, but not for focus, an unreachable pair, a page or a foundation', () => {
    const points = openPointsOf(
      input({
        parts: [
          {
            key: 'components/a',
            layer: 'components',

            controls: true,
            motion: {
              states: ['closed', 'open', 'focus-visible', 'pending'],
              motions: [
                { from: 'closed', to: 'open' },
                { from: 'pending', to: 'pending' },
              ],
              unreachable: [{ from: 'pending', to: 'closed' }],
            },
          },
          {
            key: 'pages/b',
            layer: 'pages',

            controls: true,
            motion: { states: ['default', 'empty'], motions: [], unreachable: [] },
          },
          {
            key: 'foundations/c',
            layer: 'foundations',

            controls: true,
            motion: { states: ['light', 'dark'], motions: [], unreachable: [] },
          },
          {
            key: 'components/d',
            layer: 'components',

            controls: true,
            motion: { states: ['busy-row'], motions: [], unreachable: [] },
          },
        ],
      }),
    );

    expect(points).toEqual([
      {
        part: 'components/a',
        points: [
          { kind: 'missing-motion', from: 'closed', to: 'pending' },
          { kind: 'missing-motion', from: 'open', to: 'closed' },
          { kind: 'missing-motion', from: 'open', to: 'pending' },
          { kind: 'missing-motion', from: 'pending', to: 'open' },
        ],
      },
      { part: 'components/d', points: [{ kind: 'missing-motion', from: 'busy-row', to: 'busy-row' }] },
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
          { key: 'components/a', layer: 'components', controls: true },
          { key: 'components/b', layer: 'components', controls: true },
        ],
        sketches: [
          {
            name: 'components-a',
            target: 'components/a',
            targets: ['components/a'],
            status: 'in progress',
            decision: null,
          },
          {
            name: 'components-b',
            target: 'components/b',
            targets: ['components/b'],
            status: 'ready',
            decision: 'pick',
          },
          {
            name: 'components-x',
            target: 'components/x',
            targets: ['components/x', 'components/b'],
            status: 'ready',
            decision: null,
          },
        ],
        comments: [comment('c-1', 'components/a'), comment('c-2', 'components/a', { answered: true })],
      }),
    );

    expect(openPointsText('acme', list)).toEqual([
      'OPEN POINTS acme: 6 in 3 parts',
      '  components/a: 2 open comments (c-1, c-2 addressed, waits on the user); sketch components-a is in progress - missing: sketch check, then sketch ready; the designer sees it only when ready',
      '  components/b: sketch components-b picked, not merged; sketch components-x is ready, not merged (it also targets this part)',
      '  components/x: sketch components-x is ready, not merged',
    ]);
  });

  it('prints missing states first', () => {
    const list = openPointsOf(
      input({
        parts: [
          { key: 'components/a', layer: 'components', controls: false },
          { key: 'components/b', layer: 'components', controls: true },
        ],
        missingStates: [
          { part: 'components/b', control: 'trigger.hover' },
          { part: 'components/b', control: 'menu' },
        ],
        comments: [comment('c-1', 'components/b')],
      }),
    );

    expect(openPointsText('acme', list)).toEqual([
      'OPEN POINTS acme: 4 in 2 parts',
      '  components/a: no controls declared',
      '  components/b: 2 missing states (trigger.hover, menu); 1 open comment (c-1)',
    ]);
  });
  it('prints missing motions last, a single pair, a capped list and the loops', () => {
    const states = ['rest', 'hover', 'loading', 'focus', 'disabled'];
    const list = openPointsOf(
      input({
        parts: [
          {
            key: 'components/a',
            layer: 'components',

            controls: true,
            motion: {
              states: ['collapsed', 'expanded'],
              motions: [{ from: 'expanded', to: 'collapsed' }],
              unreachable: [],
            },
          },
          {
            key: 'components/b',
            layer: 'components',

            controls: true,
            motion: { states, motions: [], unreachable: [] },
          },
        ],
      }),
    );

    expect(openPointsText('acme', list)).toEqual([
      'OPEN POINTS acme: 14 in 2 parts',
      '  components/a: no motion collapsed -> expanded',
      "  components/b: 12 missing motions (rest -> hover, rest -> loading, rest -> disabled, hover -> rest, hover -> loading, hover -> disabled, +6 more); no looping motion in loading (add to motions: loading: { from: 'loading', to: 'loading' })",
    ]);
  });

  it('names one motions entry per looping state', () => {
    const list = openPointsOf(
      input({
        parts: [
          {
            key: 'components/b',
            layer: 'components',

            controls: true,
            motion: { states: ['loading', 'pending'], motions: [], unreachable: [], instant: true },
          },
        ],
      }),
    );

    expect(openPointsText('acme', list)).toEqual([
      'OPEN POINTS acme: 2 in 1 part',
      "  components/b: no looping motion in loading, pending (add to motions: loading: { from: 'loading', to: 'loading' }, pending: { from: 'pending', to: 'pending' })",
    ]);
  });
});

describe('sketchAddedPointsOf', () => {
  it('keeps the points the merged part already has apart, matched by part, kind and subject', () => {
    expect(
      sketchAddedPointsOf(
        [
          {
            part: 'components/a',
            points: [
              { kind: 'missing-state', control: null },
              { kind: 'missing-motion', from: 'rest', to: 'hover' },
              { kind: 'missing-motion', from: 'rest', to: 'focus' },
            ],
          },
        ],
        [
          {
            part: 'components/a',
            points: [
              { kind: 'missing-state', control: null },
              { kind: 'missing-motion', from: 'rest', to: 'hover' },
              { kind: 'missing-motion', from: 'hover', to: 'rest' },
              { kind: 'missing-motion', from: 'rest', to: 'focus' },
            ],
          },
          { part: 'components/new', points: [{ kind: 'missing-motion', from: 'rest', to: 'hover' }] },
        ],
      ),
    ).toEqual({
      added: [
        {
          part: 'components/a',
          points: [{ kind: 'missing-motion', from: 'hover', to: 'rest' }],
        },
        { part: 'components/new', points: [{ kind: 'missing-motion', from: 'rest', to: 'hover' }] },
      ],
      inherited: [
        {
          part: 'components/a',
          points: [
            { kind: 'missing-state', control: null },
            { kind: 'missing-motion', from: 'rest', to: 'hover' },
            { kind: 'missing-motion', from: 'rest', to: 'focus' },
          ],
        },
      ],
    });
  });

  it('asks a motion only for a pair an interaction word connects, not between showcase variants (B297)', () => {
    expect(
      openPointsOf(
        input({
          parts: [
            {
              key: 'components/a',
              layer: 'components',

              controls: true,
              motion: {
                states: ['empty', 'filled', 'hover', 'hover-filled', 'tonal', 'size-sm'],
                motions: [],
                unreachable: [],
              },
            },
          ],
        }),
      ),
    ).toEqual([
      {
        part: 'components/a',
        points: [
          { kind: 'missing-motion', from: 'empty', to: 'hover' },
          { kind: 'missing-motion', from: 'filled', to: 'hover-filled' },
          { kind: 'missing-motion', from: 'hover', to: 'empty' },
          { kind: 'missing-motion', from: 'hover-filled', to: 'filled' },
        ],
      },
    ]);
  });

  it('asks no motion between different states of a part that declares instant switches, but still a loop in an ongoing-work state', () => {
    expect(
      openPointsOf(
        input({
          parts: [
            {
              key: 'components/a',
              layer: 'components',

              controls: true,
              motion: { states: ['closed', 'open', 'pending'], motions: [], unreachable: [], instant: true },
            },
          ],
        }),
      ),
    ).toEqual([{ part: 'components/a', points: [{ kind: 'missing-motion', from: 'pending', to: 'pending' }] }]);
  });

  it('asks a loop in a state whose render is busy whatever its name, as the comment-draft sending state (finding 311)', () => {
    const draft = (busyStates: OpenPointsInput['busyStates']) =>
      openPointsOf(
        input({
          parts: [
            {
              key: 'components/comment-draft',
              layer: 'components',

              controls: true,
              motion: { states: ['empty', 'typed', 'sending', 'error'], motions: [], unreachable: [], instant: true },
            },
          ],
          busyStates,
        }),
      );

    expect(draft([])).toEqual([]);
    expect(
      draft([
        { part: 'components/comment-draft', state: 'sending' },
        { part: 'components/other', state: 'typed' },
      ]),
    ).toEqual([
      { part: 'components/comment-draft', points: [{ kind: 'missing-motion', from: 'sending', to: 'sending' }] },
    ]);
  });
});

describe('required data states (B251a)', () => {
  const part = (key: string, states: string[], takesData?: boolean) => ({
    key,
    layer: key.startsWith('pages/') ? ('pages' as const) : ('components' as const),
    controls: true,
    takesData,
    motion: { states, motions: states.map((state) => ({ from: state, to: state })), unreachable: [], instant: true },
  });

  it('asks a part that takes data for each of loading, error and empty it does not draw, a page too', () => {
    expect(
      openPointsOf(
        input({
          parts: [part('components/list', ['rest', 'loading'], true), part('pages/feed', ['rest'], true)],
        }),
      ),
    ).toEqual([
      {
        part: 'components/list',
        points: [
          { kind: 'missing-state', control: null, data: 'error' },
          { kind: 'missing-state', control: null, data: 'empty' },
        ],
      },
      {
        part: 'pages/feed',
        points: [
          { kind: 'missing-state', control: null, data: 'loading' },
          { kind: 'missing-state', control: null, data: 'error' },
          { kind: 'missing-state', control: null, data: 'empty' },
        ],
      },
    ]);
  });

  it('takes the committed names of each state as words of a state name', () => {
    expect(
      openPointsOf(input({ parts: [part('components/a', ['listing-pending', 'load-failed', 'no-results'], true)] })),
    ).toEqual([]);
    expect(openPointsOf(input({ parts: [part('components/b', ['busy', 'errored', 'table-empty'], true)] }))).toEqual(
      [],
    );
    expect(openPointsOf(input({ parts: [part('components/c', ['loaded', 'terror', 'emptyish'], true)] }))).toEqual([
      {
        part: 'components/c',
        points: [
          { kind: 'missing-state', control: null, data: 'loading' },
          { kind: 'missing-state', control: null, data: 'error' },
          { kind: 'missing-state', control: null, data: 'empty' },
        ],
      },
    ]);
  });

  it('leaves a presentational part, a foundation and a part without readable states alone', () => {
    expect(
      openPointsOf(
        input({
          parts: [
            part('components/plain', ['rest']),
            { ...part('foundations/data', ['rest'], true), layer: 'foundations' as const },
            { key: 'components/unread', layer: 'components', controls: true, takesData: true },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('prints the missing data states apart from the controls, and keeps the no controls line', () => {
    const list = openPointsOf(
      input({ parts: [{ ...part('components/a', ['rest', 'empty'], true), controls: false }] }),
    );

    expect(openPointsText('acme', list)).toEqual([
      'OPEN POINTS acme: 3 in 1 part',
      '  components/a: no controls declared; data part without the states loading, error',
    ]);
  });

  it('takes a part with a dataStates map by the states it names, not by the words of its state names (B251)', () => {
    const dataStates = { loading: 'comparing', error: 'listing-failed', empty: 'no-sketches' };
    const list = openPointsOf(
      input({
        parts: [{ ...part('pages/sketches', ['comparing', 'failed', 'list-error', 'none'], true), dataStates }],
      }),
    );

    expect(list).toEqual([
      {
        part: 'pages/sketches',
        points: [
          { kind: 'missing-state', control: null, data: 'error', state: 'listing-failed' },
          { kind: 'missing-state', control: null, data: 'empty', state: 'no-sketches' },
        ],
      },
    ]);
    expect(openPointsText('studio', list)).toEqual([
      'OPEN POINTS studio: 2 in 1 part',
      '  pages/sketches: data part without the states error (listing-failed), empty (no-sketches)',
    ]);
    expect(
      openPointsOf(
        input({
          parts: [{ ...part('pages/sketches', ['comparing', 'listing-failed', 'no-sketches'], true), dataStates }],
        }),
      ),
    ).toEqual([]);
  });

  it('counts a sketch that draws one data state as adding nothing (ADR 0095)', () => {
    const merged = openPointsOf(input({ parts: [part('components/a', ['rest'], true)] }));
    const sketched = openPointsOf(input({ parts: [part('components/a', ['rest', 'loading'], true)] }));

    expect(sketchAddedPointsOf(merged, sketched)).toEqual({
      added: [],
      inherited: [
        {
          part: 'components/a',
          points: [
            { kind: 'missing-state', control: null, data: 'error' },
            { kind: 'missing-state', control: null, data: 'empty' },
          ],
        },
      ],
    });
  });
});
