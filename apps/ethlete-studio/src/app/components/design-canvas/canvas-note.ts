import { Point, Rect } from './canvas-math';

/**
 * A note that always shows its text. With `frameId` its card hangs below that frame, and a `point` adds a numbered
 * marker on the frame; otherwise at `at` in world coordinates, or stacked above the top left of everything.
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

/**
 * The marker of a pointed note on its frame; `column` is the top left of the column below the frame its card sits in,
 * `number` counts the pointed notes of the frame from 1, as the card shows it.
 */
export type PlacedNoteMarker = Point & { key: string; number: number; column: Point };

/** Tells apart the copies of one note on several frames. */
export const noteKeyOf = (note: Pick<CanvasNote, 'id' | 'frameId'>) => `${note.id} ${note.frameId ?? ''}`;

/** The space between a frame and the column of notes below it. */
export const NOTE_BELOW_GAP = 16;
const ABOVE_GAP = 24;
const CONNECTOR_GUTTER = 12;
const CONNECTOR_DROP = 16;

const columnBelow = (frame: Rect): Point => ({ x: frame.x, y: frame.y + frame.height + NOTE_BELOW_GAP });

/** A frame notes can sit on; a cell of a grid names the grid frame as its `owner`, and its notes hang below the grid. */
export type NoteFrame = Rect & { owner?: string };

const hangOf = ({ frameId, frame, owners }: { frameId: string; frame: NoteFrame; owners: Map<string, Rect> }) => {
  const owner = frame.owner === undefined ? undefined : owners.get(frame.owner);

  return owner && frame.owner !== undefined ? { id: frame.owner, rect: owner } : { id: frameId, rect: frame };
};

/** Puts each note on the canvas; a note on a frame the canvas does not show is left out. */
export const placeNotes = (
  notes: CanvasNote[],
  {
    frames,
    owners = new Map(),
    bounds,
  }: { frames: Map<string, NoteFrame>; owners?: Map<string, Rect>; bounds: Rect | null },
): PlacedNoteGroup[] => {
  const below = new Map<string, { rect: Rect; notes: CanvasNote[] }>();
  const above: CanvasNote[] = [];
  const single: PlacedNoteGroup[] = [];

  for (const note of notes) {
    const frame = note.frameId === undefined ? null : frames.get(note.frameId);

    if (note.frameId !== undefined && !frame) continue;

    if (frame && note.frameId !== undefined) {
      const hang = hangOf({ frameId: note.frameId, frame, owners });

      below.set(hang.id, { rect: hang.rect, notes: [...(below.get(hang.id)?.notes ?? []), note] });
    } else if (note.at) {
      single.push({ key: noteKeyOf(note), anchor: 'at', ...note.at, notes: [note] });
    } else {
      above.push(note);
    }
  }

  return [
    ...[...below].map(([frameId, { rect, notes: stacked }]) => ({
      key: `below ${frameId}`,
      anchor: 'below' as const,
      frameId,
      ...columnBelow(rect),
      notes: stacked,
    })),
    ...single,
    ...(above.length > 0 && bounds
      ? [{ key: 'above', anchor: 'above' as const, x: bounds.x, y: bounds.y - ABOVE_GAP, notes: above }]
      : []),
  ];
};

/** The markers of the pointed notes on frames the canvas shows. */
export const placeNoteMarkers = (
  notes: CanvasNote[],
  { frames, owners = new Map() }: { frames: Map<string, NoteFrame>; owners?: Map<string, Rect> },
): PlacedNoteMarker[] => {
  const counts = new Map<string, number>();

  return notes.flatMap((note) => {
    const frame = note.frameId === undefined ? undefined : frames.get(note.frameId);

    if (!frame || !note.point || note.frameId === undefined) return [];

    const hang = hangOf({ frameId: note.frameId, frame, owners });
    const number = (counts.get(hang.id) ?? 0) + 1;

    counts.set(hang.id, number);

    return [
      {
        key: noteKeyOf(note),
        number,
        x: frame.x + note.point.x,
        y: frame.y + note.point.y,
        column: columnBelow(hang.rect),
      },
    ];
  });
};

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
