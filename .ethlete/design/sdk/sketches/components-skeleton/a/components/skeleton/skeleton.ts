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
  note: 'The SDK skeleton (et-skeleton), drawn by its mock from @ethlete/components/design on the page: bones filled with --et-surface-interaction-solid at 12% over the page, 4px radius (12px on the story rect), 8px gap; a text bone is 0.85em tall with margins filling a 1.4em line; circles are --et-skeleton-size square and round. The shimmer is a 90deg gradient of --et-surface-interaction-solid at 16% sweeping across each bone in 1400ms, held still at the middle of its sweep. States: the story card (40px avatar, two lines, 140px rect), three text lines with a 60% last line, the bare shapes (text, rect, circles 24/40/64), a bare text bone inside a sentence as in the story (outside an et-skeleton, so it has no shimmer), and the card without the shimmer (animated off, also what reduced motion shows). The skeleton is not interactive: no hover, no focus, no colour theme.',
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
