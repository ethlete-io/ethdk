import { ListedNote } from '../../host/design-notes';
import { CanvasFrame, FramePlace, REST } from '../components/design-canvas/canvas-frame';
import { Point } from '../components/design-canvas/canvas-math';
import { CanvasNote } from '../components/design-canvas/canvas-note';

/** A note the user is typing: on a frame, optionally at a point on it. */
export type NoteDraft = { frameId: string; place: FramePlace; point: Point | null };

/** The note the user is changing; `key` is the copy the user clicked. */
export type NoteEdit = { id: string; key: string };

const stateNoteOf = (note: ListedNote, frameId: string): CanvasNote => ({
  id: note.id,
  text: note.text,
  frameId,
  ...(note.point ? { point: note.point } : {}),
});

/** Whether a note shows at a size: a pointed note only at the size it was written at, any other at every size. */
export const showsAtSize = (note: Pick<ListedNote, 'point' | 'size'>, size: string | number) =>
  !note.point || note.size === undefined || note.size === size;

const isRestFrameOf = (place: FramePlace | undefined, note: ListedNote) =>
  !!place &&
  !place.sketch &&
  (place.interaction ?? REST) === REST &&
  place.part === note.part &&
  place.state === note.state &&
  showsAtSize(note, place.size);

/** Each note on every frame that draws its part and state at rest, at its size. */
export const partNotesOf = (frames: CanvasFrame[], notes: ListedNote[]): CanvasNote[] =>
  notes.flatMap((note) =>
    frames.filter((frame) => isRestFrameOf(frame.place, note)).map((frame) => stateNoteOf(note, frame.id)),
  );

/** Rounds a point to whole CSS pixels for the note file. */
export const roundedPoint = ({ x, y }: Point): Point => ({ x: Math.round(x), y: Math.round(y) });
