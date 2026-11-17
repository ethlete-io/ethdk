import { definePart, drawing, html } from '@design-system';
import styles from './rating.css?inline';

type Props = { value: number };

export default definePart<Props>({
  note: 'A five-star rating for a film.',
  states: { empty: { value: 0 }, three: { value: 3 }, full: { value: 5 } },
  describe: {
    empty: 'Five faded stars with 0/5 beside them; check that no star is lit and the count sits after the stars.',
    three: 'Three of five stars lit with 3/5 beside them; check that the lit stars match the count.',
    full: 'All five stars lit with 5/5 beside them; check that every star shows in the accent and the count stays aligned.',
  },
  render: ({ value }) =>
    drawing({
      body: html`<div class="rating" aria-label="${value} of 5">
        ${[1, 2, 3, 4, 5].map((star) => `<span class="rating__star${star <= value ? ' is-on' : ''}">★</span>`).join('')}
        <span class="rating__count">${value}/5</span>
      </div>`,
      styles,
    }),
});
