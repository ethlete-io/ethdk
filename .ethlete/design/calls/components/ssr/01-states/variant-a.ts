import { themeCss } from '@ethlete/core/design/theme-css';
import { css, drawing, html, ngStates } from '@design-explore';
import { COLOR_THEMES, SURFACE_THEMES } from '../../themes';

const flow = await ngStates(
  {
    view: html`<div class="panel">
      <p class="name">Ada Lovelace</p>
      <div class="row"><button et-button variant="outline" data-edit>Edit</button></div>
    </div>`,
    edit: html`<div class="panel">
      <et-form-field>
        <et-label>Name</et-label>
        <et-input placeholder="Your name" />
        <et-hint>As it appears on your pass</et-hint>
      </et-form-field>
      <div class="row">
        <button et-button data-done>Save</button>
        <button et-button variant="tonal" data-done>Cancel</button>
      </div>
    </div>`,
  },
  { imports: ['BUTTON_IMPORTS', 'FORM_FIELD_IMPORTS', 'INPUT_IMPORTS'] },
);

export default drawing({
  body: flow.body,
  setup: flow.on([
    { click: '[data-edit]', go: 'edit' },
    { click: '[data-done]', go: 'view' },
  ]),
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
    .name {
      margin: 0;
      font-size: 1.6rem;
    }
    .row {
      display: flex;
      gap: 12px;
    }
  `,
});
