import { formField } from '@ethlete/components/design/form-field';
import { select, selectStyles } from '@ethlete/components/design/select';
import { css, drawing, html } from '@design-explore';
import { frameStyles } from './shared';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
];

const selects = (surface: string) =>
  html`<div class="et-surface--${surface} panel">
    ${formField({
      id: `${surface}-pick`,
      label: 'Team',
      errorColor: 'danger',
      control: select({ options: OPTIONS, placeholder: 'Pick a team' }),
    })}
    ${formField({
      id: `${surface}-open`,
      label: 'Team',
      open: true,
      errorColor: 'danger',
      control: select({ options: OPTIONS, value: 'b', active: 'c', panelColor: 'brand', panelSurface: surface }),
    })}
  </div>`;

export default drawing({
  body: html`${selects('light')}${selects('dark')}`,
  styles: css`
    ${frameStyles(selectStyles)}
    .panel {
      padding-block-end: 160px;
    }
  `,
});
