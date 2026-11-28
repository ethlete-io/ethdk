import { boundsOf, ChangedBox, pngSizeOf } from './contact-sheet';
import { PictureOf } from './merge-compare';
import { BoxOf, FrameSize } from './variant-diff';

/** The box around every pixel a state changes against the part's base state at rest, `null` for none, in the picture `frame` it was found in. */
export type StateDiff = { box: ChangedBox | null; frame: FrameSize };

/**
 * Draws `state` of a part in `interaction` and its `base` state at rest, both at the same size and theme, and answers
 * the box around the pixels that differ; the base state itself at rest is drawn once and has no box.
 */
export const stateDiffOf = async (options: {
  product: string;
  part: string;
  state: string;
  interaction: string | null;
  base: string;
  preset: string | null;
  width: number | null;
  params: URLSearchParams;
  pictureOf: PictureOf;
  boxOf: BoxOf;
}): Promise<StateDiff> => {
  const { product, part, state, interaction, base, preset, width, params, pictureOf, boxOf } = options;
  const draw = (drawn: string, forced: string | null) =>
    pictureOf({
      product,
      part,
      state: drawn,
      preset,
      width,
      sketch: null,
      interaction: forced,
      params,
      priority: 'low',
    });

  if (state === base && interaction === null) {
    const { png } = await draw(base, null);

    return { box: null, frame: pngSizeOf(png) };
  }

  const [before, after] = await Promise.all([draw(base, null), draw(state, interaction)]);

  return { box: boundsOf(await boxOf(before.png, after.png)), frame: pngSizeOf(after.png) };
};
