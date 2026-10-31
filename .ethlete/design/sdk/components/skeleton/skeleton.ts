import { skeleton, skeletonItem, skeletonStyles, skeletonText } from '@ethlete/components/design/skeleton';
import { definePart, drawing } from '@design-system';
import frame from './skeleton.css?inline';

type Props = {
  form: 'card' | 'text' | 'shapes' | 'in-text';
  animated: boolean;
};

const CARD = [
  `<div class="skeleton-row">${skeletonItem({ shape: 'circle', style: '--et-skeleton-size: 40px' })}${skeletonText({ lines: 2 })}</div>`,
  skeletonItem({ shape: 'rect', style: 'block-size: 140px; --et-skeleton-radius: 12px' }),
].join('');

const SHAPES = [
  skeletonItem(),
  skeletonItem({ shape: 'rect', style: 'block-size: 80px' }),
  `<div class="skeleton-row">${[24, 40, 64].map((size) => skeletonItem({ shape: 'circle', style: `--et-skeleton-size: ${size}px` })).join('')}</div>`,
].join('');

const render = ({ form, animated }: Props) => {
  switch (form) {
    case 'card':
      return skeleton({ content: CARD, animated });
    case 'text':
      return skeleton({ content: skeletonText(), animated });
    case 'shapes':
      return skeleton({ content: SHAPES, animated });
    case 'in-text':
      return `<p class="skeleton-text">Real text, then ${skeletonItem({ style: 'max-inline-size: 120px' })} in the middle of it.</p>`;
  }
};

export default definePart({
  note: "Today's look",
  madeBy: ['claude-opus-5-5'],
  states: {
    card: { form: 'card', animated: true },
    text: { form: 'text', animated: true },
    shapes: { form: 'shapes', animated: true },
    'in-text': { form: 'in-text', animated: true },
    static: { form: 'card', animated: false },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="skeleton-frame">${render(props)}</div>`,
      styles: [skeletonStyles, frame].join('\n'),
    }),
});
