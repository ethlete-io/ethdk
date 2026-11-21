export type MarkerAnchor = { number: string; x: number; y: number };

export type PlacedMarker = { number: string; left: number; top: number; width: number; height: number };

const HEIGHT = 16;

const CHAR_WIDTH = 7;

const PADDING = 8;

const GAP = 4;

const widthOf = (number: string) => number.length * CHAR_WIDTH + PADDING;

const overlaps = (a: PlacedMarker, b: PlacedMarker) =>
  a.left < b.left + b.width + GAP &&
  b.left < a.left + a.width + GAP &&
  a.top < b.top + b.height + GAP &&
  b.top < a.top + a.height + GAP;

const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));

/**
 * Places one marker per anchor, in order, as near its anchor (a box's top-left corner, in frame pixels) as a free
 * slot allows: a marker never overlaps an earlier one and stays inside the frame.
 */
export const placeMarkers = (anchors: MarkerAnchor[], frame: { width: number; height: number }): PlacedMarker[] => {
  const placed: PlacedMarker[] = [];
  const stepX = CHAR_WIDTH * 2;
  const stepY = HEIGHT + GAP;

  for (const anchor of anchors) {
    const width = widthOf(anchor.number);
    const candidate = (dx: number, dy: number): PlacedMarker => ({
      number: anchor.number,
      left: clamp(anchor.x - width / 2 + dx, frame.width - width),
      top: clamp(anchor.y - HEIGHT / 2 + dy, frame.height - HEIGHT),
      width,
      height: HEIGHT,
    });
    const rings = Math.ceil(Math.max(frame.width, frame.height) / Math.min(stepX, stepY));
    let best: PlacedMarker | null = null;

    search: for (let ring = 0; ring <= rings; ring++) {
      for (let row = -ring; row <= ring; row++) {
        for (let col = -ring; col <= ring; col++) {
          if (Math.max(Math.abs(row), Math.abs(col)) !== ring) continue;

          const next = candidate(col * stepX, row * stepY);

          if (!placed.some((other) => overlaps(next, other))) {
            best = next;
            break search;
          }
        }
      }
    }

    placed.push(best ?? candidate(0, 0));
  }

  return placed;
};
