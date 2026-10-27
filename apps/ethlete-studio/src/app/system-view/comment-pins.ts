import { CommentPlace, ListedComment } from '../../host/design';
import { CanvasFrame, FramePlace } from '../components/design-canvas/canvas-frame';
import { CanvasPin, FramePoint } from '../components/design-canvas/canvas-pin';

export type NumberedComment = ListedComment & { number: number };

/** A comment the user is typing, on a frame and optionally at a point on it. */
export type CommentDraft = { frameId: string; place: FramePlace; point: { x: number; y: number } | null };

/** Numbers the open comments of a product from 1, oldest first, so the list and the pins agree. */
export const numberedCommentsOf = (comments: ListedComment[]): NumberedComment[] =>
  [...comments]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((comment, index) => ({ ...comment, number: index + 1 }));

/** Whether a comment was made on the frame that draws `place`. */
export const isOnPlace = (comment: CommentPlace, place: FramePlace) =>
  comment.part === place.part &&
  comment.state === place.state &&
  comment.size === place.size &&
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

/** Where a comment sits, in words: state, size, sketch variant. */
export const commentWhereOf = (comment: CommentPlace) =>
  [
    comment.state,
    typeof comment.size === 'number' ? `${comment.size} px` : comment.size,
    ...(comment.sketch ? [`variant ${comment.sketch.variant}`] : []),
  ].join(' · ');

/** How many comments sit on the frame's part and state at another size, where no pin can show them. */
export const otherSizeCountOf = (place: FramePlace, comments: CommentPlace[]) =>
  comments.filter((comment) => isOnPlace(comment, { ...place, size: comment.size }) && comment.size !== place.size)
    .length;

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
