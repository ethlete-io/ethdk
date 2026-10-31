import { picture, pictureStyles, type PictureMockOptions } from '@ethlete/components/design/picture';
import { skeletonItem, skeletonStyles } from '@ethlete/components/design/skeleton';
import { definePart, drawing } from '@design-system';
import fallback from '@assets/fallback.svg?raw';
import tall from '@assets/tall.svg?raw';
import wide from '@assets/wide.svg?raw';
import frame from './picture.css?inline';

const svgUrl = (markup: string) => `data:image/svg+xml;utf8,${encodeURIComponent(markup.trim())}`;

type Fit = NonNullable<PictureMockOptions['fit']>;

type Props = {
  ratio?: string;
  caption?: 'short' | 'long' | 'none';
  intrinsic?: boolean;
  loading?: boolean;
  error?: 'slot' | 'bare';
  fit?: boolean;
};

const WIDE = svgUrl(wide);
const TALL = svgUrl(tall);
const FALLBACK = svgUrl(fallback);
const BROKEN = 'data:image/png;base64,this-is-not-an-image';

const CAPTIONS = {
  short: 'A crop that follows the viewport.',
  long: 'Fulltime at the home ground: the visitors celebrate in front of the away end after the late winner, while the stewards hold the line and the floodlights come on over the north stand.',
  none: undefined,
};

const FITS: Fit[] = ['contain', 'cover', 'fill', 'none', 'scale-down'];

const body = ({ ratio = '16 / 9', caption = 'short', intrinsic, loading, error, fit }: Props) => {
  if (fit) {
    const cells = FITS.map(
      (mode) =>
        `<figure class="picture-fit-cell">${picture({ src: FALLBACK, alt: `fit ${mode}`, fit: mode })}<span>${mode}</span></figure>`,
    ).join('');

    return `<div class="picture-fit-grid">${cells}</div>`;
  }

  if (loading) {
    return picture({
      alt: 'An image whose URL arrives after the page',
      aspectRatio: '16 / 9',
      state: 'loading',
      placeholder: skeletonItem({ shape: 'rect', style: 'block-size: 100%; inline-size: 100%' }),
    });
  }

  if (error) {
    return picture({
      src: BROKEN,
      alt: 'An image that fails to load',
      aspectRatio: '16 / 9',
      state: 'error',
      error: error === 'slot' ? '<p class="picture-error">This image is unavailable.</p>' : undefined,
    });
  }

  return picture({
    sources: intrinsic ? undefined : [{ srcset: WIDE, media: '(min-width: 700px)' }, { srcset: TALL }],
    src: FALLBACK,
    alt: 'A coloured block labelled with its aspect ratio',
    aspectRatio: ratio === 'none' ? undefined : ratio,
    width: intrinsic ? 800 : undefined,
    height: intrinsic ? 450 : undefined,
    figcaption: CAPTIONS[caption],
  });
};

export default definePart({
  note: 'The SDK picture (et-picture), drawn by its mock from @ethlete/components/design, framed as its story does (max 520px, surface fill, 14px text). A figure with a picture (sources + img) and an optional figcaption; the component paints nothing itself: no colour, edge, radius, focus ring or interactive state exists in the lib. The caption inherits the surface text; placeholder and error slots are overlaid on the reserved box and bring their own look (story: a rect skeleton, a 12px muted line). Images are local SVG assets with preserveAspectRatio none so they stretch like a raster would. States: default (art direction: the tall 3:4 source wins at 480px and is stretched into the 16:9 box, as the lib does without fit), ratio-4-3, no-ratio (natural size), width-height (800x450 attributes, no reserved ratio), no-caption, long-caption (wraps), fit (contain, cover, fill, none, scale-down in a 180x120 box; dashed outline is the frame, not the lib), loading (placeholder skeleton, no URL yet), error-slot, error-bare (browser broken icon with alt text).',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    'ratio-4-3': { ratio: '4 / 3' },
    'no-ratio': { ratio: 'none' },
    'width-height': { intrinsic: true },
    'no-caption': { caption: 'none' },
    'long-caption': { caption: 'long' },
    fit: { fit: true },
    loading: { loading: true },
    'error-slot': { error: 'slot' },
    'error-bare': { error: 'bare' },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="picture-frame">${body(props)}</div>`,
      styles: [skeletonStyles, pictureStyles, frame].join('\n'),
    }),
});
