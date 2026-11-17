import { definePart, drawing, html } from '@design-system';
import styles from './tokens.css?inline';

export default definePart<{ swatch: string }>({
  note: 'Three tokens: surface, text and one accent.',
  states: { accent: { swatch: '--acme-accent' } },
  describe: { accent: 'The accent token; check its name.' },
  render: ({ swatch }) => drawing({ body: html`<code class="acme-token">${swatch}</code>`, styles }),
});
