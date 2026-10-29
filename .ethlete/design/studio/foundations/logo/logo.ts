import { definePart, drawing, html } from '@design-system';
import tokens from '@system/foundations/tokens.css?inline';
import mark from '@assets/studio-mark.svg?raw';
import styles from './logo.css?inline';

type View = 'sizes' | 'sidebar';

export const studioMark = (size: number) => mark.replace('width="32" height="32"', `width="${size}" height="${size}"`);

const sizes = html`<div class="lg-root">
  <h2 class="lg-title">Mark at app-icon sizes</h2>
  <div class="lg-row">
    ${[16, 32, 512].map((size) => html`<div class="lg-size">${studioMark(size)}<span class="lg-label">${size} px</span></div>`).join('')}
    <div class="lg-size">
      <div class="lg-light">${studioMark(16)}${studioMark(32)}</div>
      <span class="lg-label">on a light bar</span>
    </div>
  </div>
</div>`;

const sidebar = html`<div class="lg-root">
  <aside class="lg-sidebar">
    <header class="lg-header">${studioMark(20)}<span class="lg-name">Studio</span></header>
    <nav class="lg-nav">
      <span class="lg-item lg-item--on">Foundations</span>
      <span class="lg-item">Components</span>
      <span class="lg-item">Sketches</span>
    </nav>
  </aside>
</div>`;

export default definePart<{ view: View }>({
  note: 'best',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: { sizes: { view: 'sizes' }, sidebar: { view: 'sidebar' } },
  render: ({ view }) => drawing({ body: view === 'sizes' ? sizes : sidebar, styles: `${tokens}${styles}` }),
});
