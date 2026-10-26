import { css, drawing } from '@design-explore';
import { BASE, PHONE, stackOnClick } from './fixture';

export default drawing({
  body: PHONE,
  setup: stackOnClick,
  styles: css`
    ${BASE}
    .phone[data-stacked] .sheet--first {
      transform: translateY(-10px) scale(0.92);
    }
    .phone[data-stacked] .scrim--sheet {
      opacity: 1;
    }
  `,
});
