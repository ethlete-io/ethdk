import { definePart, drawing, html } from '@design-system';
import styles from './rating.css?inline';

type Props = { value: number };

export default definePart<Props>({
  note: 'A rating as a bar with the score beside it.',
  states: {
    empty: { value: 0 },
    three: { value: 3 },
    full: { value: 5 },
  },
  interactions: ['disabled'],
  render: ({ value }) =>
    drawing({
      body: html`<div class="rating">
        <span class="rating__bar"><span class="rating__fill" style="width: ${value * 20}%"></span></span>
        <span class="rating__score">${value}/5</span>
      </div>`,
      styles,
    }),
});
