import { pngSizeOf } from '../../contact-sheet';
import { PictureOf } from '../../merge-compare';
import { ResolvedProduct } from '../resolve-product';
import { Sketch } from './sketch';

/** The size of the picture of one state of a target part, as the product draws it (`variant: null`) or one variant. */
export type ShotFrame = {
  part: string;
  variant: string | null;
  state: string;
  preset: string | null;
  width: number | null;
  frame: { width: number; height: number };
};

type Drawn = { variant: string | null; states: readonly string[]; widths?: readonly number[] };

const SCHEMES = ['light', 'dark'];

const sizesOf = ({ product, sketch, drawn }: { product: ResolvedProduct; sketch: Sketch; drawn: readonly Drawn[] }) => {
  if (sketch.layer === 'pages') return Object.keys(product.presets).map((preset) => ({ preset, width: null }));

  const widths = [...new Set(drawn.flatMap((entry) => entry.widths ?? []))].sort((a, b) => a - b);

  return widths.length > 0
    ? widths.map((width) => ({ preset: null, width }))
    : [{ preset: null, width: null as number | null }];
};

/**
 * The frame size of each shot of `part` the sketch view shows, read from the pictures drawn before in the default
 * theme: one per state of the product's part and of each variant in `drawn`, at each preset of a page, else each
 * declared width, else fitted. A shot without a kept picture is left out; nothing is drawn.
 */
export const shotFramesOf = async ({
  product,
  sketch,
  part,
  drawn,
  pictureOf,
}: {
  product: ResolvedProduct;
  sketch: Sketch;
  part: string;
  drawn: readonly Drawn[];
  pictureOf: PictureOf;
}): Promise<ShotFrame[]> => {
  const sizes = sizesOf({ product, sketch, drawn });
  const keptOf = async (shot: Omit<ShotFrame, 'frame'>) => {
    for (const scheme of SCHEMES) {
      const picture = await pictureOf({
        product: product.name,
        part,
        state: shot.state,
        preset: shot.preset,
        width: shot.width,
        sketch: shot.variant === null ? null : { target: sketch.target, variant: shot.variant },
        interaction: null,
        params: new URLSearchParams({ scheme }),
        kept: true,
      }).catch(() => null);

      if (picture) return [{ ...shot, frame: pngSizeOf(picture.png) }];
    }

    return [];
  };

  const frames = await Promise.all(
    drawn.flatMap(({ variant, states }) =>
      states.flatMap((state) => sizes.map((size) => keptOf({ part, variant, state, ...size }))),
    ),
  );

  return frames.flat();
};
