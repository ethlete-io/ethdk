import { Point, Rect } from './canvas-math';

/**
 * A note that always shows its text. With `frameId` it sits on that frame, at `point` or below the frame;
 * otherwise at `at` in world coordinates, or stacked above the top left of everything. A `heading` has no card.
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

/** Where a group of notes sits: `point` marks a spot, `below` hangs under a frame, `above` stands on top of everything. */
export type NoteAnchor = 'point' | 'below' | 'at' | 'above';

export type PlacedNoteGroup = Point & { key: string; anchor: NoteAnchor; notes: CanvasNote[] };

/** Tells apart the copies of one note on several frames. */
export const noteKeyOf = (note: Pick<CanvasNote, 'id' | 'frameId'>) => `${note.id} ${note.frameId ?? ''}`;

const BELOW_GAP = 16;
const ABOVE_GAP = 24;

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

    if (frame && note.point) {
      single.push({
        key: noteKeyOf(note),
        anchor: 'point',
        x: frame.x + note.point.x,
        y: frame.y + note.point.y,
        notes: [note],
      });
    } else if (frame && note.frameId !== undefined) {
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
        ? [
            {
              key: `below ${frameId}`,
              anchor: 'below' as const,
              x: frame.x,
              y: frame.y + frame.height + BELOW_GAP,
              notes: stacked,
            },
          ]
        : [];
    }),
    ...single,
    ...(above.length > 0 && bounds
      ? [{ key: 'above', anchor: 'above' as const, x: bounds.x, y: bounds.y - ABOVE_GAP, notes: above }]
      : []),
  ];
};
