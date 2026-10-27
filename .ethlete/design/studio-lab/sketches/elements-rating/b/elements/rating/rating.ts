import { definePart, drawing, html } from '@design-system';
import styles from './rating.css?inline';

type Props = { value: number; disabled: boolean };

export default definePart<Props>({
  note: 'A rating as a bar with the score beside it.',
  states: {
    empty: { value: 0, disabled: false },
    three: { value: 3, disabled: false },
    full: { value: 5, disabled: false },
    disabled: { value: 3, disabled: true },
  },
  render: ({ value, disabled }) =>
    drawing({
      body: html`<div class="rating${disabled ? ' is-disabled' : ''}">
        <span class="rating__bar"><span class="rating__fill" style="width: ${value * 20}%"></span></span>
        <span class="rating__score">${value}/5</span>
      </div>`,
      styles,
    }),
});
