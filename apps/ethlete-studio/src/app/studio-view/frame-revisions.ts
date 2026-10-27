import { EMPTY, Observable, filter, fromEvent, map } from 'rxjs';
import { DrawnPart, PartsRedraw } from '../../host/design-parts';
import { frameMessageOf } from '../components/design-canvas/canvas-frame';

/**
 * What each drawn part last reloaded at. Every change takes the next `seq`, so a frame's revision only
 * ever grows, also across a design server restart. `failing` holds the frames that reported an error,
 * with the `seq` they reported it at.
 */
export type FrameRevisions = {
  seq: number;
  all: number;
  errored: number;
  parts: Record<string, number>;
  failing: Record<string, number>;
};

export const NO_FRAME_REVISIONS: FrameRevisions = { seq: 0, all: 0, errored: 0, parts: {}, failing: {} };

/** One part frame by its URL: the part it draws, and a key for the frame itself. */
export type ReportedFrame = { drawn: DrawnPart; frame: string; revision: number };

export type FrameReport = { frame: ReportedFrame; errored: boolean };

const drawnKeyOf = ({ product, part, sketch }: DrawnPart) =>
  JSON.stringify([product, part, sketch?.target ?? null, sketch?.variant ?? null]);

export const frameRevisionsWith = (revisions: FrameRevisions, change: PartsRedraw): FrameRevisions => {
  const seq = revisions.seq + 1;

  if (change.all) return { ...revisions, seq, all: seq };

  return {
    ...revisions,
    seq,
    errored: change.errored ? seq : revisions.errored,
    parts: { ...revisions.parts, ...Object.fromEntries(change.parts.map((drawn) => [drawnKeyOf(drawn), seq])) },
  };
};

/** Reads the part frame a frame page URL draws; null for a call frame. */
export const reportedFrameOf = (src: string): ReportedFrame | null => {
  if (!URL.canParse(src)) return null;

  const params = new URL(src).searchParams;
  const product = params.get('product');
  const part = params.get('part');

  if (!product || !part) return null;

  const target = params.get('sketch');
  const variant = params.get('variant');
  const drawn = { product, part, sketch: target && variant ? { target, variant } : null };
  const revision = Number(params.get('revision') ?? 0);

  params.delete('revision');
  params.delete('epoch');

  return { drawn, frame: JSON.stringify([drawnKeyOf(drawn), params.toString()]), revision };
};

/**
 * Records whether a frame shows an error. A failing frame reloads on the next `errored` change; one that
 * draws again keeps the revision it shows.
 */
export const frameRevisionsWithReport = (
  revisions: FrameRevisions,
  { frame: { drawn, frame, revision }, errored }: FrameReport,
): FrameRevisions => {
  if (errored === frame in revisions.failing) return revisions;
  if (errored) return { ...revisions, failing: { ...revisions.failing, [frame]: revisions.seq } };

  const key = drawnKeyOf(drawn);
  const { [frame]: _recovered, ...failing } = revisions.failing;

  return { ...revisions, failing, parts: { ...revisions.parts, [key]: Math.max(revisions.parts[key] ?? 0, revision) } };
};

/** Emits each height report of a part frame, with whether the frame shows an error. */
export const frameReports$ = (document: Document): Observable<FrameReport> =>
  (document.defaultView ? fromEvent<MessageEvent>(document.defaultView, 'message') : EMPTY).pipe(
    map((event) => {
      const message = frameMessageOf(event.data);
      const frame = message?.type === 'height' && message.href ? reportedFrameOf(message.href) : null;

      return frame && message?.type === 'height' ? { frame, errored: !!message.errored } : null;
    }),
    filter((report) => report !== null),
  );

const failsSince = (revisions: FrameRevisions, shown: (key: string) => boolean) =>
  Object.entries(revisions.failing).some(
    ([frame, since]) => since < revisions.errored && shown((JSON.parse(frame) as [string, string])[0]),
  );

/** The revision of the frames that draw `drawn`; `errored` when they show an error now. */
export const revisionOf = (
  revisions: FrameRevisions,
  { errored = false, ...drawn }: DrawnPart & { errored?: boolean },
) => {
  const fails = errored || failsSince(revisions, (key) => key === drawnKeyOf(drawn));

  return Math.max(revisions.all, revisions.parts[drawnKeyOf(drawn)] ?? 0, fails ? revisions.errored : 0);
};

/** The revision of a sketch's frames: its target as the product has it, and every part any of its variants draws. */
export const sketchRevisionOf = (
  revisions: FrameRevisions,
  sketch: { product: string; target: string; errored?: boolean },
) => {
  const shown = (key: string) => {
    const [product, part, target] = JSON.parse(key) as [string, string, string | null];

    return product === sketch.product && (target === sketch.target || (target === null && part === sketch.target));
  };
  const fails = sketch.errored || failsSince(revisions, shown);

  return Object.entries(revisions.parts).reduce(
    (newest, [key, seq]) => (shown(key) ? Math.max(newest, seq) : newest),
    Math.max(revisions.all, fails ? revisions.errored : 0),
  );
};
