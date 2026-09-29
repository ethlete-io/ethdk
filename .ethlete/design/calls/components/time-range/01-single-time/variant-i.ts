import { css, drawing, html } from '@design-explore';
import { ACCENT, LINE, MUTED, VALUE, frameStyles, pad, trigger } from './fixture';

const SLOTS = Array.from({ length: 9 }, (_, index) => VALUE.hour * 60 + VALUE.minute + (index - 4) * 15);
const label = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <div class="list">
        ${SLOTS.map((slot) => html`<span class="slot ${label(slot) === VALUE.label ? 'selected' : ''}">${label(slot)}</span>`)}
      </div>
    </div>
  `,
  styles: css`
    ${frameStyles}

    .panel {
      padding: 0.6rem;
    }

    .list {
      display: flex;
      flex-direction: column;
      max-height: 28rem;
      overflow: hidden;
      mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
    }

    .slot {
      padding: 0.8rem 1.2rem;
      border-radius: 0.6rem;
      font-size: 1.4rem;
      font-variant-numeric: tabular-nums;
      color: ${MUTED};
    }

    .slot + .slot {
      border-top: 1px solid ${LINE};
    }

    .slot.selected {
      background: ${ACCENT};
      color: #10131a;
      font-weight: 600;
    }
  `,
});
