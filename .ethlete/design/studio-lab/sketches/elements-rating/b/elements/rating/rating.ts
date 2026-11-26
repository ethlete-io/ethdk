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
  describe: {
    empty: 'An empty bar with 0/5 beside it; check that the track shows without any accent fill.',
    three:
      'The bar three fifths filled with 3/5 beside it; check that the accent fill stops at sixty percent of the track.',
    full: 'The full bar with 5/5 beside it; check that the accent fill reaches the rounded end of the track.',
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
