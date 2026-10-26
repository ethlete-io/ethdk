import { css, drawing } from '@design-explore';
import { BASE, PHONE, stackOnClick } from './fixture';

export default drawing({
  body: PHONE,
  setup: stackOnClick,
  styles: css`
    ${BASE}
    .phone[data-stacked] .scrim--sheet {
      opacity: 1;
    }
  `,
});
