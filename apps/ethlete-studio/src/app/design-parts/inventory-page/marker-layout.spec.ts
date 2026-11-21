import { placeMarkers } from './marker-layout';

const FRAME = { width: 360, height: 225 };

const overlap = (a: ReturnType<typeof placeMarkers>[number], b: ReturnType<typeof placeMarkers>[number]) =>
  a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;

const MIN_GAP = 3;

const closeTogether = (a: ReturnType<typeof placeMarkers>[number], b: ReturnType<typeof placeMarkers>[number]) =>
  a.left < b.left + b.width + MIN_GAP &&
  b.left < a.left + a.width + MIN_GAP &&
  a.top < b.top + b.height + MIN_GAP &&
  b.top < a.top + a.height + MIN_GAP;

describe('placeMarkers', () => {
  it('keeps a gap between markers anchored along the frame bottom', () => {
    const placed = placeMarkers(
      ['24', '26', '27', '29'].map((number, index) => ({ number, x: 120 + index * 6, y: FRAME.height })),
      FRAME,
    );

    for (const [index, a] of placed.entries()) {
      for (const b of placed.slice(index + 1)) expect(closeTogether(a, b)).toBe(false);
    }
  });

  it('keeps a lone marker on its anchor', () => {
    const [marker] = placeMarkers([{ number: '1', x: 100, y: 100 }], FRAME);

    if (!marker) throw new Error('no marker');

    expect(marker.left + marker.width / 2).toBe(100);
    expect(marker.top + marker.height / 2).toBe(100);
  });

  it('separates markers that share an anchor', () => {
    const placed = placeMarkers(
      ['1', '2', '3', '22', '23'].map((number) => ({ number, x: 50, y: 50 })),
      FRAME,
    );

    for (const [index, a] of placed.entries()) {
      for (const b of placed.slice(index + 1)) expect(overlap(a, b)).toBe(false);
    }
  });

  it('stays inside the frame for anchors on the edges', () => {
    const placed = placeMarkers(
      ['1', '25', 'A3', 'O10'].flatMap((number) => [
        { number, x: 0, y: 0 },
        { number: number + 'b', x: FRAME.width, y: FRAME.height },
      ]),
      FRAME,
    );

    for (const marker of placed) {
      expect(marker.left).toBeGreaterThanOrEqual(0);
      expect(marker.top).toBeGreaterThanOrEqual(0);
      expect(marker.left + marker.width).toBeLessThanOrEqual(FRAME.width);
      expect(marker.top + marker.height).toBeLessThanOrEqual(FRAME.height);
    }
  });

  it('places thirty crowded markers without a collision', () => {
    const anchors = Array.from({ length: 30 }, (_, index) => ({ number: String(index + 1), x: 8, y: 4 + index * 6 }));
    const placed = placeMarkers(anchors, FRAME);

    for (const [index, a] of placed.entries()) {
      for (const b of placed.slice(index + 1)) expect(overlap(a, b)).toBe(false);
    }
  });
});
