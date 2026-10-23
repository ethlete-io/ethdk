import { themeCss } from '@ethlete/core/design/theme-css';
import { css, drawing, html, ng } from '@design-explore';
import { COLOR_THEMES, SURFACE_THEMES } from '../../themes';

const content = await ng(
  html`<div class="row">
    <et-form-field class="field">
      <et-label>Team</et-label>
      <et-select [open]="true" placeholder="Pick a team">
        <et-select-option value="a">Alpha</et-select-option>
        <et-select-option value="b">Beta</et-select-option>
        <et-select-option value="c">Gamma</et-select-option>
      </et-select>
    </et-form-field>
    <div [open]="true" etMenu>
      <button et-button etMenuTrigger type="button">Options</button>
      <ng-template etMenuSurface>
        <et-menu>
          <button et-menu-item>Edit</button>
          <button et-menu-item>Duplicate</button>
          <button et-menu-item>Delete</button>
        </et-menu>
      </ng-template>
    </div>
  </div>`,
  { imports: ['FORM_FIELD_IMPORTS', 'SELECT_IMPORTS', 'MENU_IMPORTS', 'BUTTON_IMPORTS'] },
);

export default drawing({
  body: html`<div class="et-surface--light panel">${content}</div>`,
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
      min-height: 320px;
      padding: 24px;
      background: var(--et-surface-background-solid);
      color: var(--et-surface-color-solid);
    }
    .row {
      display: flex;
      gap: 24px;
      align-items: end;
    }
    .field {
      width: 280px;
    }
  `,
});
