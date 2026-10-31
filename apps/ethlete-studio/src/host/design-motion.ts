import { Observable, map } from 'rxjs';
import { designAnswer$ } from './design';

/** A motion a part declares between two of its states, as the system list has it. */
export type ListedMotion = { from: string; to: string; at?: number[]; interrupt?: number; viewTransition?: boolean };

export type MotionMode = 'full' | 'reduced';

/** One animation of a motion run. `start` is the clock time it began at; `end` is null for an infinite one. */
export type MotionTrack = {
  element: string;
  kind: 'transition' | 'animation' | 'script';
  name?: string;
  properties: string[];
  start: number;
  delay: number;
  duration: number;
  iterations: number | null;
  easing: string;
  end: number | null;
  /** The foundations tokens whose value equals `duration`, in declaration order. */
  durationTokens?: string[];
  /** The foundations tokens whose value equals `easing`, in declaration order. */
  easingTokens?: string[];
};

export type MotionKeyframe = { ms: number; src: string };

/** What `GET /__design/motion` answers: one mode of a motion, its tracks and a PNG URL per keyframe. */
export type MotionAnswer = {
  product: string;
  part: string;
  motion: string;
  from: string;
  to: string;
  mode: MotionMode;
  preset: string | null;
  width: number | null;
  end: number;
  tracks: MotionTrack[];
  keyframes: MotionKeyframe[];
};

export type MotionAddress = {
  port: number;
  product: string;
  part: string;
  motion: string;
  preset?: string | null;
  mode?: MotionMode;
  surface?: string;
  color?: string;
  /** Changes with each design change, so the motion draws anew. */
  revision?: number;
};

export const motionUrl = ({ port, product, part, motion, preset, mode, surface, color, revision }: MotionAddress) =>
  `http://localhost:${port}/__design/motion?product=${encodeURIComponent(product)}` +
  `&part=${encodeURIComponent(part)}&motion=${encodeURIComponent(motion)}` +
  (preset ? `&preset=${encodeURIComponent(preset)}` : '') +
  (mode ? `&mode=${mode}` : '') +
  (surface ? `&surface=${encodeURIComponent(surface)}` : '') +
  (color ? `&color=${encodeURIComponent(color)}` : '') +
  (revision ? `&revision=${revision}` : '');

/** The motion at `address`, with each keyframe's `src` on the design server, as an `img` outside it needs. */
export const motionAnswer$ = (address: MotionAddress): Observable<MotionAnswer> => {
  const url = motionUrl(address);

  return designAnswer$<MotionAnswer>(url).pipe(
    map((answer) => ({
      ...answer,
      keyframes: answer.keyframes.map((keyframe) => ({ ...keyframe, src: new URL(keyframe.src, url).href })),
    })),
  );
};

/** The last keyframe at or before `ms`; the first one before any. */
export const keyframeAt = (keyframes: readonly MotionKeyframe[], ms: number) =>
  keyframes.reduce<MotionKeyframe | null>((shown, keyframe) => (keyframe.ms <= ms ? keyframe : shown), null) ??
  keyframes[0] ??
  null;

/** Where a track's bar sits on a timeline `end` ms long, in percent. An infinite track runs to the end. */
export const trackBarOf = (track: MotionTrack, end: number) => {
  const length = Math.max(end, 1);
  const from = Math.min(track.start + Math.max(track.delay, 0), length);
  const to = Math.min(track.end ?? length, length);

  return { left: (from / length) * 100, width: (Math.max(to - from, 0) / length) * 100 };
};

/** The first token name and a "+N" mark for N more tokens of the same value, or `raw` without one; `title` lists all. */
export const tokenLabelOf = (raw: string, tokens: readonly string[] = []) => {
  const [first] = tokens;

  if (!first) return { shown: raw, title: raw, token: false };

  return {
    shown: tokens.length > 1 ? `${first} +${tokens.length - 1}` : first,
    title: `${tokens.join(', ')}: ${raw}`,
    token: true,
  };
};
