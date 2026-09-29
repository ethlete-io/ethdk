import { css, drawing, html } from '@design-explore';
import { frameStyles, ring, trigger } from './fixture';

export default drawing({
  body: html`
    ${trigger}
    <div class="scrim"></div>
    <div class="sheet">
      <div class="grab"></div>
      <div class="step">
        <span class="back">‹</span>
        <span class="days">Fri 2 – Sun 4 Oct</span>
      </div>
      ${ring()}
    </div>
  `,
  styles: css`
    ${frameStyles}

    .step {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      height: 4.4rem;
      margin-bottom: 1.2rem;
      font-size: 1.5rem;
      font-weight: 500;
    }

    .back {
      display: grid;
      place-items: center;
      width: 4.4rem;
      height: 4.4rem;
      font-size: 2.4rem;
    }
  `,
});
