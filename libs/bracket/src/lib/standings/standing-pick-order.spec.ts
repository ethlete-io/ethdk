import { standingPickStartOrder } from './standing-pick-order';

const FIELD = ['a', 'b', 'c', 'd'];

const startOrder = (picks: { position: number; participantId: string }[], participantIds = FIELD) =>
  standingPickStartOrder({ participantIds, picks });

describe('standingPickStartOrder', () => {
  it('keeps the backend order when nothing is stored', () => {
    expect(startOrder([])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives a stored pick its position and fills the gaps in backend order', () => {
    expect(startOrder([{ position: 1, participantId: 'c' }])).toEqual(['c', 'a', 'b', 'd']);
    expect(startOrder([{ position: 3, participantId: 'a' }])).toEqual(['b', 'c', 'a', 'd']);
  });

  it('places every stored pick, whatever order they arrive in', () => {
    const picks = [
      { position: 4, participantId: 'a' },
      { position: 2, participantId: 'd' },
    ];

    expect(startOrder(picks)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('reproduces a fully stored order', () => {
    const picks = FIELD.map((participantId, index) => ({ position: FIELD.length - index, participantId }));

    expect(startOrder(picks)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('drops a pick for a position the field has no room for', () => {
    expect(startOrder([{ position: 5, participantId: 'd' }])).toEqual(['a', 'b', 'c', 'd']);
    expect(startOrder([{ position: 0, participantId: 'd' }])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops a pick naming a participant that is not in the field', () => {
    expect(startOrder([{ position: 1, participantId: 'z' }])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('lets the lowest position keep a participant picked twice', () => {
    const picks = [
      { position: 3, participantId: 'a' },
      { position: 2, participantId: 'a' },
    ];

    expect(startOrder(picks)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('keeps the first pick for a position that is stored twice', () => {
    const picks = [
      { position: 1, participantId: 'c' },
      { position: 1, participantId: 'd' },
    ];

    expect(startOrder(picks)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('returns an empty order for an empty field', () => {
    expect(startOrder([{ position: 1, participantId: 'a' }], [])).toEqual([]);
  });
});
