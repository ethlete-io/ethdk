import { DrawnPart, PartsRedraw } from '../../host/design-parts';

/**
 * What each drawn part last reloaded at. Every change takes the next `seq`, so a frame's revision only
 * ever grows, also across a design server restart.
 */
export type FrameRevisions = { seq: number; all: number; errored: number; parts: Record<string, number> };

export const NO_FRAME_REVISIONS: FrameRevisions = { seq: 0, all: 0, errored: 0, parts: {} };

const drawnKeyOf = ({ product, part, sketch }: DrawnPart) =>
  JSON.stringify([product, part, sketch?.target ?? null, sketch?.variant ?? null]);

export const frameRevisionsWith = (revisions: FrameRevisions, change: PartsRedraw): FrameRevisions => {
  const seq = revisions.seq + 1;

  if (change.all) return { ...revisions, seq, all: seq };

  return {
    seq,
    all: revisions.all,
    errored: change.errored ? seq : revisions.errored,
    parts: { ...revisions.parts, ...Object.fromEntries(change.parts.map((drawn) => [drawnKeyOf(drawn), seq])) },
  };
};

/** The revision of the frames that draw `drawn`; `errored` when they show an error now. */
export const revisionOf = (
  revisions: FrameRevisions,
  { errored = false, ...drawn }: DrawnPart & { errored?: boolean },
) => Math.max(revisions.all, revisions.parts[drawnKeyOf(drawn)] ?? 0, errored ? revisions.errored : 0);

/** The revision of a sketch's frames: its target as the product has it, and every part any of its variants draws. */
export const sketchRevisionOf = (
  revisions: FrameRevisions,
  sketch: { product: string; target: string; errored?: boolean },
) =>
  Object.entries(revisions.parts).reduce(
    (newest, [key, seq]) => {
      const [product, part, target] = JSON.parse(key) as [string, string, string | null];
      const shown =
        product === sketch.product && (target === sketch.target || (target === null && part === sketch.target));

      return shown ? Math.max(newest, seq) : newest;
    },
    Math.max(revisions.all, sketch.errored ? revisions.errored : 0),
  );
