import { openPointGroupsOf } from './open-points';

describe('openPointGroupsOf', () => {
  it('groups the points by icon in the popover order, with the texts of the System page design', () => {
    expect(
      openPointGroupsOf([
        { kind: 'missing-motion', from: 'rest', to: 'hover' },
        { kind: 'stale-go' },
        { kind: 'open-comment', comment: 'a', state: 'outline', answered: false },
        { kind: 'unmerged-sketch', status: 'ready', decision: 'pick' },
        { kind: 'contrast', state: 'tonal', path: 'label' },
        { kind: 'missing-state', control: null },
        { kind: 'missing-state', control: 'size' },
        { kind: 'open-comment', comment: 'b', state: 'filled', answered: true },
        { kind: 'no-go' },
      ]),
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
          { text: 'Go ist veraltet', detail: 'go' },
          { text: 'Noch kein Go', detail: 'go' },
        ],
      },
      { icon: 'flow', lines: [{ text: 'rest → hover', detail: 'motion' }] },
    ]);
  });

  it('has no group without a point', () => {
    expect(openPointGroupsOf([])).toEqual([]);
  });
});
