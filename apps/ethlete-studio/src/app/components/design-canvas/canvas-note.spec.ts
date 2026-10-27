import { placeNotes } from './canvas-note';

const frames = new Map([
  ['a', { x: 100, y: 200, width: 390, height: 844 }],
  ['b', { x: 800, y: 200, width: 390, height: 600 }],
]);

const bounds = { x: 100, y: 200, width: 1090, height: 844 };

describe('placeNotes', () => {
  it('puts a pointed note at its point on the frame', () => {
    expect(placeNotes([{ id: 'n', text: 't', frameId: 'a', point: { x: 40, y: 120 } }], { frames, bounds })).toEqual([
      {
        key: 'n a',
        anchor: 'point',
        x: 140,
        y: 320,
        notes: [{ id: 'n', text: 't', frameId: 'a', point: { x: 40, y: 120 } }],
      },
    ]);
  });

  it('stacks the notes on a whole state in one column below their frame', () => {
    const notes = [
      { id: 'n', text: 't', frameId: 'b' },
      { id: 'm', text: 'u', frameId: 'b' },
    ];

    expect(placeNotes(notes, { frames, bounds })).toEqual([{ key: 'below b', anchor: 'below', x: 800, y: 816, notes }]);
  });

  it('puts a free note at its world point, and one without a point above the top left of everything', () => {
    const placed = placeNotes(
      [
        { id: 'h', text: 'Heading', heading: true, at: { x: 0, y: -160 } },
        { id: 'l', text: 'Loose', heading: true },
      ],
      { frames, bounds },
    );

    expect(placed.map(({ key, anchor, x, y }) => ({ key, anchor, x, y }))).toEqual([
      { key: 'h ', anchor: 'at', x: 0, y: -160 },
      { key: 'above', anchor: 'above', x: 100, y: 176 },
    ]);
  });

  it('leaves out a note on a frame the canvas does not show', () => {
    expect(placeNotes([{ id: 'n', text: 't', frameId: 'gone' }], { frames, bounds })).toEqual([]);
  });
});
