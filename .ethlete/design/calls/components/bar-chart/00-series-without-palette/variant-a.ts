import { css, drawing, html } from '@design-explore';
import { ACCENT, BORDER, MUTED, figure, frameStyles, legend, plot } from './fixture';

const fills = [ACCENT, ACCENT, ACCENT];

export default drawing({
  body: html`
    ${legend(fills)} ${figure(plot(fills))}
    <p class="dev-note">console.warn: several series, no palette</p>
  `,
  styles: css`
    ${frameStyles}

    .dev-note {
      margin: 16px 0 0;
      padding-top: 8px;
      border-top: 1px dashed ${BORDER};
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: ${MUTED};
    }
  `,
});
