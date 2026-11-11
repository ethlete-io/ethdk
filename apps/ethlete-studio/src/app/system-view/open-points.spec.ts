import { buildReadyStatusOf, openPointGroupsOf } from './open-points';

describe('openPointGroupsOf', () => {
  it('groups the points by icon in the popover order, with the texts of the System page design', () => {
    expect(
      openPointGroupsOf({
        points: [
          { kind: 'missing-motion', from: 'rest', to: 'hover' },
          { kind: 'open-comment', comment: 'a', state: 'outline', answered: false },
          { kind: 'unmerged-sketch', status: 'ready', decision: 'pick' },
          { kind: 'contrast', state: 'tonal', path: 'label' },
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
          { text: 'Sketch gewählt, noch nicht gemergt', detail: 'sketch' },
          { text: 'Keine Controls deklariert', detail: 'controls' },
          { text: 'size hat keinen gezeichneten Zustand', detail: 'size' },
        ],
      },
      { icon: 'warning', lines: [{ text: 'label liegt unter der Kontrastregel', detail: 'tonal' }] },
      {
        icon: 'comment',
        lines: [
          { text: 'Wartet auf den Agenten', detail: 'outline' },
          { text: 'Beantwortet, wartet auf dich', detail: 'filled' },
        ],
      },
      {
        icon: 'error',
        lines: [
          {
            text: 'Kein Prüfergebnis zum aktuellen Design - Design-Check oder Design-Ready ausführen',
            detail: 'stale-record',
          },
          { text: 'elements/icon ist noch nicht baubereit', detail: 'elements/icon' },
        ],
      },
      { icon: 'flow', lines: [{ text: 'rest → hover', detail: 'motion' }] },
    ]);
  });

  it('lists a rule problem of a sketch variant as an error that names the rule', () => {
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
        ],
        buildReady: { ready: true },
      }),
    ).toEqual([{ icon: 'error', lines: [{ text: 'Sketch-Regel verletzt: UTILITY-CSS', detail: 'c' }] }]);
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
          { text: 'Bild ohne Sketch geändert', detail: 'components/tree-row@edit' },
          { text: 'Die langsamen Prüfungen sind für den aktuellen Stand noch nicht gelaufen', detail: 'pending' },
        ],
      },
    ]);
  });

  it('has no group without a point on a build-ready part', () => {
    expect(openPointGroupsOf({ points: [], buildReady: { ready: true } })).toEqual([]);
  });
});

describe('openPointGroupsOf blockers', () => {
  const linesOf = (blocker: { kind: string; text: string; part?: string }) =>
    openPointGroupsOf({ points: [], buildReady: { ready: false, blockers: [blocker] } })[0]?.lines;

  it('translates a pending slow check', () => {
    expect(linesOf({ kind: 'pending', text: 'the slow checks have not run on the current inputs' })).toEqual([
      { text: 'Die langsamen Prüfungen sind für den aktuellen Stand noch nicht gelaufen', detail: 'pending' },
    ]);
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
  it('reads a build-ready part as ready', () => {
    expect(buildReadyStatusOf({ points: [], buildReady: { ready: true } })).toEqual({ state: 'ready' });
  });

  it('reads a part without a current check record or with slow checks running as checking', () => {
    for (const kind of ['stale-record', 'pending'])
      expect(
        buildReadyStatusOf({ points: [], buildReady: { ready: false, blockers: [{ kind, text: 'not checked' }] } }),
      ).toEqual({ state: 'checking' });
  });

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

  it('reads a product without a harness as blocked, not checking', () => {
    expect(
      buildReadyStatusOf({
        points: [],
        buildReady: { ready: false, blockers: [{ kind: 'no-harness', text: 'the product has no harness' }] },
      }),
    ).toEqual({
      state: 'blocked',
      blockers: [{ kind: 'problem', text: 'Kein Harness - ohne Harness in config.json laufen die App-Prüfungen nie' }],
    });
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
