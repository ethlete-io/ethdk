import { CommentPlace, CommentResolution, ListedComment } from '../../host/design';
import { CanvasFrame, FramePlace, REST } from '../components/design-canvas/canvas-frame';

export type NumberedComment = ListedComment & { number: number };

export const isQuestion = (comment: Pick<ListedComment, 'threadState'>) => comment.threadState === 'question';

export const isAnswered = (comment: Pick<ListedComment, 'threadState'>) => comment.threadState === 'answered';

/** Numbers the open comments of a product from 1, oldest first, so the list and the pins agree. */
export const numberedCommentsOf = (comments: ListedComment[]): NumberedComment[] =>
  [...comments]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((comment, index) => ({ ...comment, number: index + 1 }));

type ResolvedComment = ListedComment & { resolved: CommentResolution };

/** The resolved threads among `comments`, the latest resolved first. */
export const resolvedCommentsOf = (comments: ListedComment[]): ResolvedComment[] =>
  comments
    .filter((comment): comment is ResolvedComment => !!comment.resolved)
    .sort((a, b) => b.resolved.resolvedAt.localeCompare(a.resolved.resolvedAt) || a.id.localeCompare(b.id));

const interactionOf = (place: { interaction?: string }) => place.interaction ?? REST;

const isOnPlace = (comment: CommentPlace, place: FramePlace) =>
  comment.part === place.part &&
  comment.state === place.state &&
  comment.size === place.size &&
  interactionOf(comment) === interactionOf(place) &&
  comment.sketch?.target === place.sketch?.target &&
  comment.sketch?.variant === place.sketch?.variant;

/** Whether the sketch view shows a comment: one made in this sketch, or one on a page the target is used in. */
export const isInSketch = (
  comment: CommentPlace,
  { sketch, contextPages }: { sketch: { createdAt: string }; contextPages: ReadonlySet<string> },
) => (comment.sketch ? comment.sketch.createdAt === sketch.createdAt : contextPages.has(comment.part));

/**
 * The frame to move the camera to for a comment: its state and interaction at the size on show, else its state in
 * the interaction on show.
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
