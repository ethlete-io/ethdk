import { definePart, drawing, html } from '@design-system';
import styles from './palette.css?inline';

export default definePart<Record<string, never>>({
  note: 'Acme overrides the base accent with its brand orange.',
  states: { default: {} },
  render: () => drawing({ body: html`<div class="acme-swatch">Accent</div>`, styles }),
});
