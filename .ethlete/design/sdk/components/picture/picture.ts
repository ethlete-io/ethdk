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
  note: "Today's look",
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
  describe: {
    default:
      'A 16 / 9 picture with a short caption; check that the image fills the ratio box and the caption sits below.',
    'ratio-4-3': 'The picture at 4 / 3; check that the box is taller and the image crops instead of stretching.',
    'no-ratio': 'The picture with no ratio; check that it takes the natural height of the image.',
    'width-height':
      'The fallback image with width 800 and height 450; check that it scales to the frame at that ratio.',
    'no-caption': 'The picture without a caption; check that no empty space is left below the image.',
    'long-caption': 'The picture with a long caption; check that the caption wraps under the image without overflow.',
    fit: 'Five cells for contain, cover, fill, none and scale-down; check that each image follows its object-fit.',
    loading: 'A picture still loading; check that a skeleton fills the 16 / 9 box.',
    'error-slot': 'A broken image with an error slot; check that This image is unavailable shows in the 16 / 9 box.',
    'error-bare':
      'A broken image with no error slot; check that the box keeps its ratio and shows no broken-image icon.',
  },
  widths: [480],
  frame: (body) => `<div class="picture-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: body(props),
      styles: [skeletonStyles, pictureStyles, frame].join('\n'),
    }),
});
