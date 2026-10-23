import { formField, formFieldStyles, input } from '@ethlete/components/design/form-field';
import { drawing, html } from '@design-explore';
import { frameStyles } from './shared';

const fields = (surface: string) =>
  html`<div class="et-surface--${surface} panel">
    ${formField({
      id: `${surface}-name`,
      label: 'Name',
      hint: 'Shown on your profile',
      errorColor: 'danger',
      control: input({ placeholder: 'Your name' }),
    })}
    ${formField({
      id: `${surface}-email`,
      label: 'Email',
      required: true,
      error: 'This field is required',
      errorColor: 'danger',
      control: input(),
    })}
    ${formField({
      id: `${surface}-city`,
      label: 'City',
      labelMode: 'floating-inside',
      focused: true,
      errorColor: 'danger',
      control: input({ value: 'Hamburg' }),
    })}
    ${formField({
      id: `${surface}-team`,
      label: 'Team',
      disabled: true,
      errorColor: 'danger',
      control: input({ value: 'Alpha' }),
    })}
  </div>`;

export default drawing({
  body: html`${fields('light')}${fields('dark')}`,
  styles: frameStyles(formFieldStyles),
});
