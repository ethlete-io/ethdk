import { css, drawing, html } from '@design-explore';
import { INK, PLOT_HEIGHT, SURFACE, figure, frameStyles } from './fixture';

const DANGER = '#c62828';

export default drawing({
  body: html`
    ${figure(
      html`<div class="dev-error">
        <strong>ET5101: [BarChartDirective]</strong>
        <span>Three series share one color. Several series need provideColorPalette(), or a colorToken each.</span>
      </div>`,
      false,
    )}
  `,
  styles: css`
    ${frameStyles}

    .dev-error {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 6px;
      box-sizing: border-box;
      block-size: ${PLOT_HEIGHT}px;
      padding: 16px;
      border: 1px solid ${DANGER};
      border-radius: 6px;
      background: color-mix(in srgb, ${DANGER} 6%, ${SURFACE});
      font-family: ui-monospace, monospace;
      font-size: 12px;
      color: ${INK};
    }

    .dev-error strong {
      color: ${DANGER};
    }
  `,
});
