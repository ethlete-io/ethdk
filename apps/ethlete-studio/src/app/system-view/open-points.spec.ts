import { buildReadyStatusOf, openPointGroupsOf, sketchPointGroupsOf } from './open-points';

describe('openPointGroupsOf', () => {
  it('groups the points by icon in the popover order, with the texts of the System page design', () => {
    // B695: a comment waiting on the agent and a missing check record are no action of the human, so neither lists.
    expect(
      openPointGroupsOf({
        points: [
          { kind: 'missing-motion', from: 'rest', to: 'hover' },
          { kind: 'open-comment', comment: 'a', state: 'outline', answered: false },
          { kind: 'unmerged-sketch', sketch: 'rating', primary: true, status: 'ready', decision: 'pick' },
          { kind: 'missing-state', control: null },
          { kind: 'missing-state', control: 'size' },
          { kind: 'open-comment', comment: 'b', state: 'filled', answered: true },
        ],
        buildReady: {
          ready: false,
          blockers: [
            { kind: 'open-point', text: '1 missing motion' },
            { kind: 'stale-record', text: 'no check record at the current design' },
            { kind: 'embedded', text: 'elements/icon is not build-ready', part: 'elements/icon' },
          ],
        },
      }),
    ).toEqual([
      {
        icon: 'grid',
        lines: [
          {
            text: 'Sketch gewählt, noch nicht gemergt',
            detail: 'sketch',
            target: { kind: 'sketch', sketch: 'rating' },
          },
          { text: 'Keine Controls deklariert', detail: 'controls' },
          { text: 'size hat keinen gezeichneten Zustand', detail: 'size' },
        ],
      },
      {
        icon: 'comment',
        lines: [{ text: 'Beantwortet, wartet auf dich', detail: 'filled', target: { kind: 'comment', comment: 'b' } }],
      },
      {
        icon: 'error',
        lines: [
          {
            text: 'elements/icon ist noch nicht baubereit',
            detail: 'elements/icon',
            target: { kind: 'part', part: 'elements/icon' },
          },
        ],
      },
      {
        icon: 'flow',
        lines: [{ text: 'rest → hover', detail: 'motion', target: { kind: 'state', state: 'rest' } }],
      },
    ]);
  });

  it('lists no rule problem and no stale base of a sketch', () => {
    // B695: the agent fixes a sketch rule problem and rebases a stale sketch, so the human sees neither.
    expect(
      openPointGroupsOf({
        points: [
          {
            kind: 'sketch-problem',
            sketch: 'rating',
            variant: 'c',
            rule: 'UTILITY-CSS',
            message: 'display: flex outside foundations',
          },
          { kind: 'stale-sketch-base', sketch: 'rating', changed: ['pages/system'] },
        ],
        buildReady: { ready: true },
      }),
    ).toEqual([]);
  });

  it('lists a direct edit with the blockers, with its edit sketch or without one', () => {
    expect(
      openPointGroupsOf({
        points: [
          { kind: 'direct-edit', sketch: null },
          { kind: 'direct-edit', sketch: 'components/tree-row@edit' },
        ],
        buildReady: {
          ready: false,
          blockers: [
            { kind: 'pending', text: 'slow checks running' },
            { kind: 'open-point', text: 'changed outside a sketch - design check draws it' },
          ],
        },
      }),
    ).toEqual([
      {
        icon: 'error',
        lines: [
          { text: 'Bild ohne Sketch geändert', detail: 'direct-edit' },
          {
            text: 'Bild ohne Sketch geändert',
            detail: 'components/tree-row@edit',
            target: { kind: 'edit-sketch', target: 'components/tree-row@edit' },
          },
        ],
      },
    ]);
  });

  it('leaves the points without a place to open as plain lines', () => {
    const lines = openPointGroupsOf({
      points: [
        { kind: 'missing-state', control: null },
        { kind: 'missing-state', control: 'size' },
        { kind: 'direct-edit', sketch: null },
      ],
      buildReady: {
        ready: false,
        blockers: [
          { kind: 'stale-record', text: 'x' },
          { kind: 'embedded', text: 'x is not build-ready' },
        ],
      },
    }).flatMap((group) => group.lines);

    expect(lines).toHaveLength(4);
    expect(lines.filter((line) => line.target)).toEqual([]);
  });

  it('opens a missing motion at its start state and a blocker that names a part at that part', () => {
    const targets = openPointGroupsOf({
      points: [{ kind: 'missing-motion', from: 'busy', to: 'idle' }],
      buildReady: { ready: false, blockers: [{ kind: 'embedded', text: 'x', part: 'components/badge' }] },
    }).flatMap((group) => group.lines.map((line) => line.target));

    expect(targets).toEqual([
      { kind: 'part', part: 'components/badge' },
      { kind: 'state', state: 'busy' },
    ]);
  });

  it('names a missing data state, not a missing control (B251a)', () => {
    const lines = openPointGroupsOf({
      points: [{ kind: 'missing-state', control: null, data: 'empty' }],
      buildReady: { ready: false, blockers: [] },
    }).flatMap((group) => group.lines);

    expect(lines.map(({ text, detail }) => ({ text, detail }))).toEqual([
      { text: 'Daten-Part ohne Zustand Leer', detail: 'empty' },
    ]);
  });

  it('names the state the data-states map gives a missing data state (B314)', () => {
    const lines = openPointGroupsOf({
      points: [{ kind: 'missing-state', control: null, data: 'empty', state: 'no-sketches' }],
      buildReady: { ready: false, blockers: [] },
    }).flatMap((group) => group.lines);

    expect(lines.map(({ text, detail }) => ({ text, detail }))).toEqual([
      { text: 'Daten-Part ohne Zustand Leer', detail: 'empty (no-sketches)' },
    ]);
  });

  it('has no group without a point on a build-ready part', () => {
    expect(openPointGroupsOf({ points: [], buildReady: { ready: true } })).toEqual([]);
  });
});

describe('openPointGroupsOf blockers', () => {
  const linesOf = (blocker: { kind: string; text: string; part?: string }) =>
    openPointGroupsOf({ points: [], buildReady: { ready: false, blockers: [blocker] } })[0]?.lines;

  it('lists no pending slow check, no missing check record and no missing harness', () => {
    // B695: the agent runs the checks and the CLI reports a missing harness, so the human sees none of them.
    expect(linesOf({ kind: 'pending', text: 'the slow checks have not run on the current inputs' })).toBeUndefined();
    expect(linesOf({ kind: 'stale-record', text: 'no check record' })).toBeUndefined();
    expect(linesOf({ kind: 'no-harness', text: 'the product has no harness' })).toBeUndefined();
  });

  it('keeps the CLI text of a kind without a label', () => {
    expect(linesOf({ kind: 'problem', text: 'contrast: too low' })).toEqual([
      { text: 'contrast: too low', detail: 'problem' },
    ]);
  });

  it('keeps the CLI text of an embedded blocker without a part', () => {
    expect(linesOf({ kind: 'embedded', text: 'x is not build-ready' })).toEqual([
      { text: 'x is not build-ready', detail: 'embedded' },
    ]);
  });
});

describe('buildReadyStatusOf', () => {
  it('carries the reasons of a developer part beside the status (B250c)', () => {
    const developer = ['injects the service Store (src/x.component.ts)'];

    expect(buildReadyStatusOf({ points: [], buildReady: { ready: true }, developer })).toEqual({
      state: 'ready',
      developer,
    });
    expect(
      buildReadyStatusOf({
        points: [],
        buildReady: { ready: false, blockers: [{ kind: 'compare', text: 'hover weicht ab' }] },
        developer,
      }),
    ).toMatchObject({ state: 'blocked', developer });
  });

  it('reads a build-ready part as ready', () => {
    expect(buildReadyStatusOf({ points: [], buildReady: { ready: true } })).toEqual({ state: 'ready' });
  });

  it('reads a part without a current check record or with slow checks running as checking', () => {
    for (const kind of ['stale-record', 'pending'])
      expect(
        buildReadyStatusOf({ points: [], buildReady: { ready: false, blockers: [{ kind, text: 'not checked' }] } }),
      ).toEqual({ state: 'checking' });
  });

  // A definite blocker reads Nicht baubereit even while a check is pending.
  it('reads a definite blocker as blocked while a slow check still runs, without the pending check', () => {
    expect(
      buildReadyStatusOf({
        points: [],
        buildReady: {
          ready: false,
          blockers: [
            { kind: 'problem', text: 'HARD-CODED-COLOUR: button.ts uses #ff0000' },
            { kind: 'pending', text: 'slow checks running' },
          ],
        },
      }),
    ).toEqual({
      state: 'blocked',
      blockers: [{ kind: 'problem', text: 'HARD-CODED-COLOUR: button.ts uses #ff0000' }],
    });
  });

  it('reads a direct edit as blocked while a slow check still runs', () => {
    expect(
      buildReadyStatusOf({
        points: [{ kind: 'direct-edit', sketch: null }],
        buildReady: {
          ready: false,
          blockers: [
            { kind: 'stale-record', text: 'no check record at the current design' },
            { kind: 'pending', text: 'slow checks running' },
            { kind: 'open-point', text: 'changed outside a sketch - design check draws it' },
          ],
        },
      }),
    ).toEqual({ state: 'blocked', blockers: [{ kind: 'direct-edit', text: 'Bild ohne Sketch geändert' }] });
  });

  it('reads a pending check beside a missing check record as checking', () => {
    expect(
      buildReadyStatusOf({
        points: [],
        buildReady: {
          ready: false,
          blockers: [
            { kind: 'stale-record', text: 'no check record at the current design' },
            { kind: 'pending', text: 'slow checks running' },
          ],
        },
      }),
    ).toEqual({ state: 'checking' });
  });

  it('shows the direct edit, not checking, when a refused record leaves a stale-record blocker beside it', () => {
    expect(
      buildReadyStatusOf({
        points: [{ kind: 'direct-edit', sketch: 'components/title-bar@edit' }],
        buildReady: {
          ready: false,
          blockers: [
            { kind: 'stale-record', text: 'no check record at the current design' },
            {
              kind: 'open-point',
              text: 'changed outside a sketch - pick old or new in sketch components/title-bar@edit',
            },
          ],
        },
      }),
    ).toEqual({ state: 'blocked', blockers: [{ kind: 'direct-edit', text: 'Bild ohne Sketch geändert' }] });
  });

  it('reads a product without a harness as blocked, without a harness blocker', () => {
    // B695: a missing harness is a note for the developer in the CLI output, but the part is still not build-ready.
    expect(
      buildReadyStatusOf({
        points: [],
        buildReady: { ready: false, blockers: [{ kind: 'no-harness', text: 'the product has no harness' }] },
      }),
    ).toEqual({ state: 'blocked', blockers: [] });
  });

  it('counts no comment that waits on the agent and no sketch the agent fixes as a blocker', () => {
    // B695: the human cannot act on these points, so the status reads checking instead of blocked.
    expect(
      buildReadyStatusOf({
        points: [
          { kind: 'open-comment', comment: 'a', state: 'outline', answered: false },
          { kind: 'stale-sketch-base', sketch: 'system', changed: ['pages/system'] },
        ],
        buildReady: { ready: false, blockers: [{ kind: 'pending', text: 'slow checks running' }] },
      }),
    ).toEqual({ state: 'checking' });
  });

  it('lists a direct edit as its own blocker, the open points in Studio words and the rule blockers by kind', () => {
    expect(
      buildReadyStatusOf({
        points: [
          { kind: 'direct-edit', sketch: 'elements/rating@edit' },
          { kind: 'missing-motion', from: 'rest', to: 'hover' },
        ],
        buildReady: {
          ready: false,
          blockers: [
            { kind: 'open-point', text: 'changed outside a sketch; 1 missing motion' },
            { kind: 'embedded', text: 'elements/icon is not build-ready', part: 'elements/icon' },
            { kind: 'compare', text: 'hover differs' },
            { kind: 'action', text: 'click did not run' },
          ],
        },
      }),
    ).toEqual({
      state: 'blocked',
      blockers: [
        { kind: 'direct-edit', text: 'Bild ohne Sketch geändert' },
        { kind: 'open-point', text: 'rest → hover' },
        { kind: 'embedded', text: 'elements/icon ist noch nicht baubereit', part: 'elements/icon' },
        { kind: 'compare', text: 'hover differs' },
        { kind: 'problem', text: 'click did not run' },
      ],
    });
  });
});

describe('sketchPointGroupsOf', () => {
  it('lists the unmerged sketch without its stale base', () => {
    // B695: the agent rebases a stale sketch, so only the unmerged sketch lists.
    expect(
      sketchPointGroupsOf({
        points: [
          { kind: 'unmerged-sketch', sketch: 'system', primary: true, status: 'ready', decision: null },
          { kind: 'stale-sketch-base', sketch: 'system', changed: ['pages/system'] },
          { kind: 'missing-state', control: null },
        ],
        buildReady: { ready: true },
      }),
    ).toEqual([
      {
        icon: 'grid',
        lines: [{ text: 'Sketch noch nicht gemergt', detail: 'sketch', target: { kind: 'sketch', sketch: 'system' } }],
      },
    ]);
  });
});
