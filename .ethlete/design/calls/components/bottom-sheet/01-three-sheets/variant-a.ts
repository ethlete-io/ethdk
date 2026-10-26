import { css, drawing } from '@design-explore';
import { BASE, PHONE, stepOnClick } from './fixture';

export default drawing({
  body: PHONE,
  setup: stepOnClick,
  styles: css`
    ${BASE}
    .phone[data-depth="2"] .sheet--1,
    .phone[data-depth="3"] .sheet--2 {
      translate: 0 -10px;
      scale: 0.92;
    }
    .phone[data-depth='3'] .sheet--1 {
      translate: 0 -10px;
      scale: 0.92;
      opacity: 0;
    }
  `,
});
