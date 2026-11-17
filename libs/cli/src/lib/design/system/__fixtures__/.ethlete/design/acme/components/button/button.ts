import { definePart, drawing, html } from '@design-system';
import styles from './button.css?inline';

export type ButtonProps = { label: string };

export default definePart<ButtonProps>({
  note: 'Pill shape, because Acme rounds every action.',
  states: { default: { label: 'Play' }, long: { label: 'Play from the beginning' } },
  describe: { default: 'The play button; check its label.', long: 'A long label; check that it fits.' },
  interactions: ['hover', 'focus-visible', 'active', 'disabled'],
  render: ({ label }) => drawing({ body: html`<button class="acme-button">${label}</button>`, styles }),
});
