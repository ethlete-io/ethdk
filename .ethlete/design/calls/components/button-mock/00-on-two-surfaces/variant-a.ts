import { button, buttonStyles } from '@ethlete/components/design/button';
import { themeCss } from '@ethlete/core/design/theme-css';
import { css, drawing, html } from '@design-explore';
import { COLOR_THEMES, SURFACE_THEMES } from './fixture';

const row = () =>
  html`<div class="row">
    ${button({ label: 'Save' })} ${button({ label: 'Save', variant: 'outline' })}
    ${button({ label: 'Save', variant: 'tonal' })} ${button({ label: 'Save', variant: 'transparent' })}
    ${button({ label: 'Save', size: 'sm', pressed: true })} ${button({ label: 'Save', disabled: true })}
  </div>`;

export default drawing({
  body: html`<div class="et-surface--light panel">${row()}</div>
    <div class="et-surface--dark panel">${row()}</div>`,
  styles: css`
    ${themeCss({ surfaceThemes: SURFACE_THEMES, colorThemes: COLOR_THEMES })}
    ${buttonStyles}
    :root {
      font-size: 62.5%;
    }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
    }
    .panel {
      padding: 24px;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }
  `,
});
