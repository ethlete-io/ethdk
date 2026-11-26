import { definePart, drawing, html } from '@design-system';
import styles from './rating.css?inline';

type Props = { value: number };

export default definePart<Props>({
  note: 'A five-star rating for a film.',
  states: { empty: { value: 0 }, three: { value: 3 }, full: { value: 5 } },
  describe: {
    empty: 'Five stars with none lit; check that all of them show faded in ink.',
    three: 'Three of five stars lit; check that the first three show in the accent and the last two stay faded.',
    full: 'All five stars lit; check that every star shows in the accent at full opacity.',
  },
  render: ({ value }) =>
    drawing({
      body: html`<div class="rating" aria-label="${value} of 5">
        ${[1, 2, 3, 4, 5].map((star) => `<span class="rating__star${star <= value ? ' is-on' : ''}">★</span>`).join('')}
      </div>`,
      styles,
    }),
});
