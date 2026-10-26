import { definePart, drawing, html } from '@design-system';
import styles from './button.css?inline';

export type ButtonProps = { label: string };

export default definePart<ButtonProps>({
  note: 'A filled button in the accent colour.',
  states: { default: { label: 'Play' } },
  render: ({ label }) => drawing({ body: html`<button class="acme-button">${label}</button>`, styles }),
});
