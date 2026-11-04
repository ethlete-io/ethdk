import { openPointGroupsOf } from './open-points';

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
            text: 'Kein Prüfstand zum aktuellen Design - Design-Check oder Design-Ready ausführen',
            detail: 'stale-record',
          },
          { text: 'elements/icon ist noch nicht baubereit', detail: 'elements/icon' },
        ],
      },
      { icon: 'flow', lines: [{ text: 'rest → hover', detail: 'motion' }] },
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
