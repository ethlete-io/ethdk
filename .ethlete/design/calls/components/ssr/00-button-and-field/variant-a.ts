import { themeCss } from '@ethlete/core/design/theme-css';
import { css, drawing, html, ng } from '@design-explore';
import { COLOR_THEMES, SURFACE_THEMES } from '../../themes';

const panel = (surface: string) =>
  html`<div class="et-surface--${surface} panel">
    <div class="row">
      <button et-button>Save</button>
      <button et-button variant="outline">Save</button>
      <button et-button variant="tonal">Save</button>
      <button et-button disabled>Save</button>
    </div>
    <et-form-field>
      <et-label>Name</et-label>
      <et-input placeholder="Your name" />
      <et-hint>As it appears on your pass</et-hint>
    </et-form-field>
  </div>`;

const content = await ng(panel('light') + panel('dark'), {
  imports: ['BUTTON_IMPORTS', 'FORM_FIELD_IMPORTS', 'INPUT_IMPORTS'],
});

export default drawing({
  body: content,
  styles: css`
    ${themeCss({ surfaceThemes: SURFACE_THEMES, colorThemes: COLOR_THEMES })}
    :root {
      font-size: 62.5%;
    }
    body {
      margin: 0;
      font-family: system-ui, sans-serif;
    }
    .panel {
      display: grid;
      gap: 16px;
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
