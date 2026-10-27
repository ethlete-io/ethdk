import { CommentPlace, CommentReply, ListedComment } from '../../host/design';
import { CanvasFrame, FramePlace, REST } from '../components/design-canvas/canvas-frame';
import { CanvasPin, FramePoint } from '../components/design-canvas/canvas-pin';

export type NumberedComment = ListedComment & { number: number };

/** A comment the user is typing, on a frame and optionally at a point on it. */
export type CommentDraft = { frameId: string; place: FramePlace; point: { x: number; y: number } | null };

export const isQuestion = (comment: Pick<ListedComment, 'threadState'>) => comment.threadState === 'question';

export const isAnswered = (comment: Pick<ListedComment, 'threadState'>) => comment.threadState === 'answered';

/** Who has the last word in a thread; the user wrote the first text. */
export const lastSenderOf = (comment: { replies: readonly Pick<CommentReply, 'by'>[] }) =>
  comment.replies.at(-1)?.by ?? 'user';

export const SENDER_LABELS: Record<CommentReply['by'], string> = { user: 'You', agent: 'Agent' };

/** Numbers the open comments of a product from 1, oldest first, so the list and the pins agree. */
export const numberedCommentsOf = (comments: ListedComment[]): NumberedComment[] =>
  [...comments]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((comment, index) => ({ ...comment, number: index + 1 }));

const interactionOf = (place: { interaction?: string }) => place.interaction ?? REST;

/** Whether a comment was made on the frame that draws `place`. */
export const isOnPlace = (comment: CommentPlace, place: FramePlace) =>
  comment.part === place.part &&
  comment.state === place.state &&
  comment.size === place.size &&
  interactionOf(comment) === interactionOf(place) &&
  comment.sketch?.target === place.sketch?.target &&
  comment.sketch?.variant === place.sketch?.variant;

/** The frame a comment sits on, among the frames the canvas shows. */
export const frameOfComment = (frames: CanvasFrame[], comment: CommentPlace) =>
  frames.find((frame) => frame.place && isOnPlace(comment, frame.place)) ?? null;

/** One pin per comment whose frame the canvas shows, labelled with the comment's number. */
export const pinsOf = (frames: CanvasFrame[], comments: NumberedComment[]): CanvasPin[] =>
  comments.flatMap((comment) => {
    const frame = frameOfComment(frames, comment);

    return frame
      ? [
          {
            id: comment.id,
            frameId: frame.id,
            label: String(comment.number),
            text: comment.text,
            ...(isQuestion(comment) ? { dot: true } : {}),
            ...(comment.point ? { point: comment.point } : {}),
          },
        ]
      : [];
  });

/** Where a new comment sits: the frame's place, and the point on it the user clicked, if any. */
export const commentPlaceOf = (place: FramePlace, point: { x: number; y: number } | null): CommentPlace => ({
  ...place,
  ...(point ? { point: { x: Math.round(point.x), y: Math.round(point.y) } } : {}),
});

/** Where a comment sits, in words: state, size, interaction, sketch variant. */
export const commentWhereOf = (comment: CommentPlace) =>
  [
    comment.state,
    typeof comment.size === 'number' ? `${comment.size} px` : comment.size,
    ...(interactionOf(comment) === REST ? [] : [interactionOf(comment)]),
    ...(comment.sketch ? [`variant ${comment.sketch.variant}`] : []),
  ].join(' · ');

const otherSizeCommentsOf = (place: FramePlace, comments: CommentPlace[]) =>
  comments.filter(
    (comment) =>
      isOnPlace(comment, { ...place, size: comment.size, interaction: comment.interaction }) &&
      comment.size !== place.size,
  );

/** How many comments sit on the frame's part and state at another size, in any interaction, where no pin can show them. */
export const otherSizeCountOf = (place: FramePlace, comments: CommentPlace[]) =>
  otherSizeCommentsOf(place, comments).length;

/** A note on a state; a pointed one with a `size` shows only at that size. */
export type SizedNote = { part: string; state: string; point?: unknown; size?: string | number };

const otherSizeNotesOf = (place: FramePlace, notes: SizedNote[]) =>
  place.sketch
    ? []
    : notes.filter(
        (note): note is SizedNote & { size: string | number } =>
          !!note.point &&
          note.size !== undefined &&
          note.part === place.part &&
          note.state === place.state &&
          note.size !== place.size,
      );

/** How many comments sit on the frame's part, state and size in another interaction, where no pin can show them. */
export const otherInteractionCountOf = (place: FramePlace, comments: CommentPlace[]) =>
  comments.filter(
    (comment) =>
      isOnPlace(comment, { ...place, interaction: comment.interaction }) &&
      interactionOf(comment) !== interactionOf(place),
  ).length;

/** The open comments on a part, in its own states and in every sketch variant of it. */
export const commentsOfPart = <T extends CommentPlace>(comments: T[], part: string) =>
  comments.filter((comment) => comment.part === part);

export type CommentGroup = { part: string; comments: NumberedComment[] };

/** The open comments grouped by part: the selected part first, then the others by name. */
export const commentGroupsOf = (comments: NumberedComment[], selected: string | null): CommentGroup[] => {
  const parts = [...new Set(comments.map((comment) => comment.part))].sort((a, b) =>
    a === selected ? -1 : b === selected ? 1 : a.localeCompare(b),
  );

  return parts.map((part) => ({ part, comments: commentsOfPart(comments, part) }));
};

const MINUTE = 60_000;

/** How long ago a comment was written, in the largest whole unit: `now`, `5 min`, `3 h`, `2 d`. */
export const ageOf = (createdAt: string, now: number) => {
  const minutes = Math.floor((now - Date.parse(createdAt)) / MINUTE);

  if (!(minutes >= 1)) return 'now';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} h`;

  return `${Math.floor(minutes / (60 * 24))} d`;
};

const countOf = (count: number, noun: string) => (count === 1 ? `1 ${noun}` : `${count} ${noun}s`);

const countNoteOf = (count: number, [one, many]: [string, string]) =>
  count === 0 ? [] : [`${countOf(count, 'comment')} ${count === 1 ? one : many}`];

const otherSizeNoteOf = (place: FramePlace, { comments, notes }: { comments: CommentPlace[]; notes: SizedNote[] }) => {
  const sizedComments = otherSizeCommentsOf(place, comments);
  const sizedNotes = otherSizeNotesOf(place, notes);
  const counts = [
    ...(sizedComments.length > 0 ? [countOf(sizedComments.length, 'comment')] : []),
    ...(sizedNotes.length > 0 ? [countOf(sizedNotes.length, 'note')] : []),
  ];
  const sizes = new Set([...sizedComments, ...sizedNotes].map((item) => item.size));

  return counts.length === 0 ? [] : [`${counts.join(', ')} ${sizes.size === 1 ? 'at another size' : 'at other sizes'}`];
};

/**
 * The frames with a note on the label that counts the comments and pointed notes on the same state at other
 * sizes, and the comments in other interactions unless `everyInteraction` says each interaction has a frame of its own.
 */
export const withOtherSizeNotes = (
  frames: CanvasFrame[],
  {
    comments,
    notes: stateNotes = [],
    everyInteraction = false,
  }: { comments: CommentPlace[]; notes?: SizedNote[]; everyInteraction?: boolean },
): CanvasFrame[] =>
  frames.map((frame) => {
    if (!frame.place) return frame;

    const notes = [
      ...otherSizeNoteOf(frame.place, { comments, notes: stateNotes }),
      ...(everyInteraction
        ? []
        : countNoteOf(otherInteractionCountOf(frame.place, comments), [
            'in another interaction',
            'in other interactions',
          ])),
    ];

    return notes.length === 0 ? frame : { ...frame, note: notes.join(', ') };
  });

/**
 * The frame to move the camera to for a comment whose pin the canvas does not show: its state and
 * interaction at the size on show, else its state in the interaction on show.
 */
export const otherSizeFrameOf = (frames: CanvasFrame[], comment: CommentPlace) => {
  const placed = frames.filter((frame): frame is CanvasFrame & { place: FramePlace } => !!frame.place);
  const frame =
    placed.find((candidate) => isOnPlace({ ...comment, size: candidate.place.size }, candidate.place)) ??
    placed.find((candidate) =>
      isOnPlace({ ...comment, size: candidate.place.size, interaction: candidate.place.interaction }, candidate.place),
    );

  return frame?.id ?? null;
};

/** The draft a click in comment mode starts, on a frame the canvas shows that has a place. */
export const commentDraftOf = (frames: CanvasFrame[], pick: FramePoint): CommentDraft | null => {
  const place = frames.find((frame) => frame.id === pick.frameId)?.place;

  return place ? { frameId: pick.frameId, place, point: pick.point } : null;
};

/** What a key in the draft field does: Enter sends, Shift+Enter breaks the line, Esc cancels. */
export const draftKeyOf = (event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing'>) => {
  if (event.isComposing) return null;
  if (event.key === 'Escape') return 'cancel';

  return event.key === 'Enter' && !event.shiftKey ? 'send' : null;
};

/** Whether a key toggles comment mode: a bare `c`, outside a text field. */
export const isCommentModeKey = (event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>) =>
  event.key.toLowerCase() === 'c' &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !(
    event.target instanceof HTMLElement &&
    (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
  );
