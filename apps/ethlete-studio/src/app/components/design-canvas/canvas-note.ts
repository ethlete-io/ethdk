import { Point, Rect } from './canvas-math';

/**
 * A note that always shows its text. With `frameId` its card hangs below that frame, and a `point` adds a marker on
 * the frame joined to the card; otherwise at `at` in world coordinates, or stacked above the top left of everything.
 * A `heading` has no card.
 */
export type CanvasNote = {
  id: string;
  text: string;
  frameId?: string;
  /** CSS pixels from the frame's top left corner. */
  point?: Point;
  at?: Point;
  heading?: boolean;
};

/** Where a group of notes sits: `below` hangs under a frame, `at` at a world point, `above` stands on top of everything. */
export type NoteAnchor = 'below' | 'at' | 'above';

export type PlacedNoteGroup = Point & { key: string; anchor: NoteAnchor; notes: CanvasNote[]; frameId?: string };

/** The marker of a pointed note on its frame; `column` is the top left of the column below the frame its card sits in. */
export type PlacedNoteMarker = Point & { key: string; column: Point };

/** Tells apart the copies of one note on several frames. */
export const noteKeyOf = (note: Pick<CanvasNote, 'id' | 'frameId'>) => `${note.id} ${note.frameId ?? ''}`;

/** The space between a frame and the column of notes below it. */
export const NOTE_BELOW_GAP = 16;
const ABOVE_GAP = 24;
const CONNECTOR_GUTTER = 12;
const CONNECTOR_DROP = 16;

const columnBelow = (frame: Rect): Point => ({ x: frame.x, y: frame.y + frame.height + NOTE_BELOW_GAP });

/** Puts each note on the canvas; a note on a frame the canvas does not show is left out. */
export const placeNotes = (
  notes: CanvasNote[],
  { frames, bounds }: { frames: Map<string, Rect>; bounds: Rect | null },
): PlacedNoteGroup[] => {
  const below = new Map<string, CanvasNote[]>();
  const above: CanvasNote[] = [];
  const single: PlacedNoteGroup[] = [];

  for (const note of notes) {
    const frame = note.frameId === undefined ? null : frames.get(note.frameId);

    if (note.frameId !== undefined && !frame) continue;

    if (frame && note.frameId !== undefined) {
      below.set(note.frameId, [...(below.get(note.frameId) ?? []), note]);
    } else if (note.at) {
      single.push({ key: noteKeyOf(note), anchor: 'at', ...note.at, notes: [note] });
    } else {
      above.push(note);
    }
  }

  return [
    ...[...below].flatMap(([frameId, stacked]) => {
      const frame = frames.get(frameId);

      return frame
        ? [{ key: `below ${frameId}`, anchor: 'below' as const, frameId, ...columnBelow(frame), notes: stacked }]
        : [];
    }),
    ...single,
    ...(above.length > 0 && bounds
      ? [{ key: 'above', anchor: 'above' as const, x: bounds.x, y: bounds.y - ABOVE_GAP, notes: above }]
      : []),
  ];
};

/** The markers of the pointed notes on frames the canvas shows. */
export const placeNoteMarkers = (notes: CanvasNote[], frames: Map<string, Rect>): PlacedNoteMarker[] =>
  notes.flatMap((note) => {
    const frame = note.frameId === undefined ? undefined : frames.get(note.frameId);

    return frame && note.point
      ? [{ key: noteKeyOf(note), x: frame.x + note.point.x, y: frame.y + note.point.y, column: columnBelow(frame) }]
      : [];
  });

/**
 * The line from a marker to the left edge of its card, `top` CSS pixels down the column at `scale`. It runs
 * through the gap below the frame and left of the column, so it never crosses a card.
 */
export const noteConnectorPath = (
  { x, y, column }: PlacedNoteMarker,
  { top, scale }: { top: number; scale: number },
) => {
  const gutter = column.x - CONNECTOR_GUTTER * scale;
  const cardY = column.y + (top + CONNECTOR_DROP) * scale;

  return `M ${x} ${y} V ${column.y - NOTE_BELOW_GAP / 2} H ${gutter} V ${cardY} H ${column.x}`;
};
