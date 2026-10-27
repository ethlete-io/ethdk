import { definePart, drawing, html } from '@design-system';
import tokens from '@system/foundations/tokens.css?inline';
import styles from './logo.css?inline';

type View = 'sizes' | 'sidebar';

const mark = (size: number) =>
  html`<svg class="lg-mark" width="${size}" height="${size}" viewBox="0 0 32 32" role="img" aria-label="Ethlete Studio">
    <rect width="32" height="32" rx="8" fill="var(--accent)" />
    <path
      d="M21.17 8.62 A5.5 5.5 0 1 0 16 16 A5.5 5.5 0 1 1 10.83 23.38"
      fill="none"
      stroke="var(--on-accent)"
      stroke-width="4"
    />
  </svg>`;

const sizes = html`<div class="lg-root">
  <h2 class="lg-title">Mark at app-icon sizes</h2>
  <div class="lg-row">
    ${[16, 32, 512].map((size) => html`<div class="lg-size">${mark(size)}<span class="lg-label">${size} px</span></div>`).join('')}
    <div class="lg-size">
      <div class="lg-light">${mark(16)}${mark(32)}</div>
      <span class="lg-label">on a light bar</span>
    </div>
  </div>
</div>`;

const sidebar = html`<div class="lg-root">
  <aside class="lg-sidebar">
    <header class="lg-header">${mark(20)}<span class="lg-name">Studio</span></header>
    <nav class="lg-nav">
      <span class="lg-item lg-item--on">Foundations</span>
      <span class="lg-item">Components</span>
      <span class="lg-item">Sketches</span>
    </nav>
  </aside>
</div>`;

export default definePart<{ view: View }>({
  note: 'best',
  madeBy: ['claude-opus-5-5'],
  states: { sizes: { view: 'sizes' }, sidebar: { view: 'sidebar' } },
  render: ({ view }) => drawing({ body: view === 'sizes' ? sizes : sidebar, styles: `${tokens}${styles}` }),
});
