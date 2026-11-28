import { dirname } from 'path';
import { pngSizeOf } from '../../contact-sheet';
import { FRAME_FIT_PADDING } from '../../frame-fit-padding';
import { PictureOf } from '../../merge-compare';
import { readPictures, StateSizes } from '../accepted-pictures';
import { partOwnerOf } from '../inventory-approval';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { partHashOf } from './baseline';
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

const recordedSizesOf = ({ product, part }: { product: ResolvedProduct; part: string }): StateSizes => {
  const resolved = product.parts.find((candidate) => partKeyOf(candidate) === part);

  if (!resolved || part.startsWith('pages/')) return {};

  const owner = partOwnerOf({ product, part: resolved });
  const record = readPictures(owner.dir)[part]?.record;

  return record?.sizes && record.partHash === partHashOf({ product: owner, dir: dirname(resolved.file) })
    ? record.sizes
    : {};
};

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
 * declared width, else fitted. A picture an older picture code drew from the same files counts as kept. A fitted shot of the product's part without a kept picture takes the size its record in
 * pictures.json holds; any other shot without a kept picture is left out. Nothing is drawn.
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
  const recorded = recordedSizesOf({ product, part });
  const recordedOf = (shot: Omit<ShotFrame, 'frame'>) => {
    const size =
      shot.variant === null && shot.preset === null && shot.width === null ? recorded[shot.state] : undefined;

    return size
      ? [{ ...shot, frame: { width: size.width + 2 * FRAME_FIT_PADDING, height: size.height + 2 * FRAME_FIT_PADDING } }]
      : [];
  };
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
        kept: 'size',
      }).catch(() => null);

      if (picture) return [{ ...shot, frame: picture.size ?? pngSizeOf(picture.png) }];
    }

    return recordedOf(shot);
  };

  const frames = await Promise.all(
    drawn.flatMap(({ variant, states }) =>
      states.flatMap((state) => sizes.map((size) => keptOf({ part, variant, state, ...size }))),
    ),
  );

  return frames.flat();
};
