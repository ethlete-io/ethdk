import { definePart, drawing, html } from '@design-system';
import styles from './rating.css?inline';

type Props = { value: number };

export default definePart<Props>({
  note: 'A five-star rating for a film.',
  states: { empty: { value: 0 }, three: { value: 3 }, full: { value: 5 } },
  render: ({ value }) =>
    drawing({
      body: html`<div class="rating" aria-label="${value} of 5">
        ${[1, 2, 3, 4, 5].map((star) => `<span class="rating__star${star <= value ? ' is-on' : ''}">★</span>`).join('')}
      </div>`,
      styles,
    }),
});
