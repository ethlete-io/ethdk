import { noteConnectorPath, placeNoteMarkers, placeNotes } from './canvas-note';

const frames = new Map([
  ['a', { x: 100, y: 200, width: 390, height: 844 }],
  ['b', { x: 800, y: 200, width: 390, height: 600 }],
]);

const bounds = { x: 100, y: 200, width: 1090, height: 844 };

describe('placeNotes', () => {
  it('hangs a pointed note in the column below its frame, with the notes without a point', () => {
    const notes = [
      { id: 'n', text: 't', frameId: 'a', point: { x: 40, y: 120 } },
      { id: 'm', text: 'u', frameId: 'a' },
    ];

    expect(placeNotes(notes, { frames, bounds })).toEqual([
      { key: 'below a', anchor: 'below', frameId: 'a', x: 100, y: 1060, notes },
    ]);
  });

  it('puts the marker of a pointed note at its point and names the column of its card', () => {
    expect(
      placeNoteMarkers(
        [
          { id: 'n', text: 't', frameId: 'a', point: { x: 40, y: 120 } },
          { id: 'm', text: 'u', frameId: 'a' },
          { id: 'g', text: 'v', frameId: 'gone', point: { x: 1, y: 1 } },
          { id: 'o', text: 'w', frameId: 'b', point: { x: 2, y: 3 } },
          { id: 'p', text: 'x', frameId: 'a', point: { x: 5, y: 6 } },
        ],
        { frames },
      ).map(({ key, number }) => [key, number]),
    ).toEqual([
      ['n a', 1],
      ['o b', 1],
      ['p a', 2],
    ]);
    expect(placeNoteMarkers([{ id: 'n', text: 't', frameId: 'a', point: { x: 40, y: 120 } }], { frames })).toEqual([
      { key: 'n a', number: 1, x: 140, y: 320, column: { x: 100, y: 1060 } },
    ]);
  });

  it('runs the connector through the gap below the frame and left of the column to the card', () => {
    const marker = { key: 'n a', number: 1, x: 140, y: 320, column: { x: 100, y: 1060 } };

    expect(noteConnectorPath(marker, { top: 50, scale: 2 })).toBe('M 140 320 V 1052 H 76 V 1192 H 100');
  });

  it('stacks the notes on a whole state in one column below their frame', () => {
    const notes = [
      { id: 'n', text: 't', frameId: 'b' },
      { id: 'm', text: 'u', frameId: 'b' },
    ];

    expect(placeNotes(notes, { frames, bounds })).toEqual([
      { key: 'below b', anchor: 'below', frameId: 'b', x: 800, y: 816, notes },
    ]);
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

  it('hangs the notes of grid cells in one column below the grid, numbered per grid', () => {
    const cells = new Map([
      ['rest', { x: 150, y: 260, width: 80, height: 40, owner: 'grid' }],
      ['hover', { x: 250, y: 260, width: 80, height: 40, owner: 'grid' }],
    ]);
    const owners = new Map([['grid', { x: 100, y: 200, width: 500, height: 300 }]]);
    const notes = [
      { id: 'n', text: 't', frameId: 'rest', point: { x: 4, y: 4 } },
      { id: 'm', text: 'u', frameId: 'hover', point: { x: 4, y: 4 } },
    ];

    expect(placeNotes(notes, { frames: cells, owners, bounds })).toEqual([
      { key: 'below grid', anchor: 'below', frameId: 'grid', x: 100, y: 516, notes },
    ]);
    expect(placeNoteMarkers(notes, { frames: cells, owners })).toEqual([
      { key: 'n rest', number: 1, x: 154, y: 264, column: { x: 100, y: 516 } },
      { key: 'm hover', number: 2, x: 254, y: 264, column: { x: 100, y: 516 } },
    ]);
  });

  it('leaves out a note on a frame the canvas does not show', () => {
    expect(placeNotes([{ id: 'n', text: 't', frameId: 'gone' }], { frames, bounds })).toEqual([]);
  });
});
