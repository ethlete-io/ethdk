import { ListedFlow } from '../../host/design-flows';
import { ListedNote } from '../../host/design-notes';
import { CanvasFrame, FramePlace, REST } from '../components/design-canvas/canvas-frame';
import { Point } from '../components/design-canvas/canvas-math';
import { CanvasNote } from '../components/design-canvas/canvas-note';
import { frameIdOf } from './flow-frames';

/** A note the user is typing: on a frame, optionally at a point on it, or free on a flow at a world point. */
export type NoteDraft = { frameId: string; place: FramePlace; point: Point | null } | { flow: string; at: Point };

/** The note the user is changing; `flow` names the flow of a free note, `key` the copy the user clicked. */
export type NoteEdit = { id: string; key: string; flow: string | null };

const stateNoteOf = (note: ListedNote, frameId: string): CanvasNote => ({
  id: note.id,
  text: note.text,
  frameId,
  ...(note.point ? { point: note.point } : {}),
});

const isRestFrameOf = (place: FramePlace | undefined, note: ListedNote) =>
  !!place &&
  !place.sketch &&
  (place.interaction ?? REST) === REST &&
  place.part === note.part &&
  place.state === note.state;

/** Each note on every frame that draws its part and state at rest. */
export const partNotesOf = (frames: CanvasFrame[], notes: ListedNote[]): CanvasNote[] =>
  notes.flatMap((note) =>
    frames.filter((frame) => isRestFrameOf(frame.place, note)).map((frame) => stateNoteOf(note, frame.id)),
  );

/** The notes on the states of a flow, on their frames, and the flow's free notes as headings. */
export const flowNotesOf = (flow: ListedFlow, notes: ListedNote[]): CanvasNote[] => [
  ...notes.flatMap((note) =>
    flow.frames.some((frame) => frame.part === note.part && frame.state === note.state)
      ? [stateNoteOf(note, frameIdOf(note))]
      : [],
  ),
  ...flow.notes.map(({ id, text, at }) => ({ id, text, heading: true, ...(at ? { at } : {}) })),
];

/** Rounds a point to whole CSS pixels for the note file. */
export const roundedPoint = ({ x, y }: Point): Point => ({ x: Math.round(x), y: Math.round(y) });
