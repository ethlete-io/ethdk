import { css, drawing, html } from '@design-explore';
import { CENTER, INK, MUTED, SIZE, VALUE, frameStyles, pad, ringStyles, trigger } from './fixture';
import { hourRing } from './hour-ring';

const chevron = (y: number, up: boolean) =>
  `<path class="chevron" d="M ${CENTER - 7} ${y + (up ? 4 : -4)} L ${CENTER} ${y + (up ? -3 : 3)} L ${CENTER + 7} ${y + (up ? 4 : -4)}" />`;

export default drawing({
  body: html`
    ${trigger}
    <div class="panel">
      <svg viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">
        ${hourRing()} ${chevron(CENTER - 30, true)}
        <text class="minute" x="${CENTER}" y="${CENTER}">:${pad(VALUE.minute)}</text>
        ${chevron(CENTER + 30, false)}
      </svg>
    </div>
  `,
  styles: css`
    ${frameStyles}
    ${ringStyles}

    svg text.minute {
      fill: ${INK};
      font-size: 24px;
      font-weight: 500;
    }

    .chevron {
      fill: none;
      stroke: ${MUTED};
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
});
