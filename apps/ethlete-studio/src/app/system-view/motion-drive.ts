import { Observable, filter, fromEvent, map, startWith, take } from 'rxjs';
import { CanvasFrame, placeableFramesOf } from '../components/design-canvas/canvas-frame';

/** What the motion timeline posts into a live frame; `libs/cli/design/motion-drive.ts` reads it. */
export type MotionDriveMessage =
  | { type: 'design-explore:motion-start'; motion: string; reduced: boolean }
  | { type: 'design-explore:motion-seek'; ms: number; rate: number }
  | { type: 'design-explore:motion-play'; ms: number; rate: number }
  | { type: 'design-explore:motion-stop' };

/** The canvas the timeline drives a frame of. */
export type MotionCanvas = {
  frames: () => readonly CanvasFrame[];
  activate: (id: string) => void;
  focusFrame: (id: string) => void;
  liveWindowOf: (id: string) => Window | null;
};

/**
 * The frame or grid cell a motion plays in: its `from` state at rest, at `preset` when one of them has it, else the
 * first.
 */
export const motionFrameIdOf = (frames: readonly CanvasFrame[], options: { state: string; preset: string | null }) => {
  const resting = placeableFramesOf(frames).filter(
    (frame) => frame.place?.state === options.state && !frame.place.interaction,
  );

  return (resting.find((frame) => frame.place?.size === options.preset) ?? resting[0])?.id ?? null;
};

export const postDrive = (target: Window, message: MotionDriveMessage) => target.postMessage(message, '*');

/** Starts `motion` in the live frame `target` and emits it once the frame answers ready; `null` until then. */
export const drivenFrame$ = (options: {
  host: Window;
  target: Window;
  motion: string;
  reduced: boolean;
}): Observable<Window | null> => {
  const { host, target, motion, reduced } = options;
  const ready$ = fromEvent<MessageEvent>(host, 'message').pipe(
    filter((event) => event.source === target),
    filter(({ data }) => {
      const reply = data as { type?: unknown; motion?: unknown } | null;

      return reply?.type === 'design-explore:motion-ready' && reply.motion === motion;
    }),
    take(1),
    map(() => target),
    startWith(null),
  );

  return new Observable<Window | null>((subscriber) => {
    const subscription = ready$.subscribe(subscriber);

    postDrive(target, { type: 'design-explore:motion-start', motion, reduced });

    return subscription;
  });
};
