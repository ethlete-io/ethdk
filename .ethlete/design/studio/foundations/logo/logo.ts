import { definePart, drawing, html, svgAsset } from '@design-system';
import mark from '@assets/studio-mark.svg?raw';
import markLine from '@assets/studio-mark-line.svg?raw';

type View = 'sizes' | 'sidebar';

export const studioMark = (size: number) => svgAsset(mark, { size });

/** The mark as a single line in `currentColor`, without the tile, for the app rail. */
export const studioMarkLine = (size: number) => svgAsset(markLine, { size });

const sizes = html`<div class="flex flex-col gap-space-4 p-space-6 bg-surface text-text font-ui text-ui-md">
  <h2 class="m-0 text-ui-xl font-ui-strong">Mark at app-icon sizes</h2>
  <div class="flex items-end gap-space-6">
    ${[16, 32, 512].map((size) => html`<div class="flex flex-col items-center gap-space-2">${studioMark(size)}<span class="font-code text-ui-xs text-text-muted">${size} px</span></div>`).join('')}
    <div class="flex flex-col items-center gap-space-2">
      <div class="flex items-center gap-space-3 px-space-3 py-space-2 rounded-control-md bg-text">
        ${studioMark(16)}${studioMark(32)}
      </div>
      <span class="font-code text-ui-xs text-text-muted">on a light bar</span>
    </div>
  </div>
  <h2 class="m-0 text-ui-xl font-ui-strong">Line mark in the rail</h2>
  <div class="flex items-end gap-space-6">
    ${[16, 24, 32].map((size) => html`<div class="flex flex-col items-center gap-space-2">${studioMarkLine(size)}<span class="font-code text-ui-xs text-text-muted">${size} px</span></div>`).join('')}
  </div>
</div>`;

const sidebar = html`<div class="flex flex-col gap-space-4 p-space-6 bg-surface text-text font-ui text-ui-md">
  <aside class="flex flex-col w-60 h-80 bg-surface border border-surface-border rounded-control-lg overflow-hidden">
    <header class="flex items-center gap-space-2 h-11 px-space-3 border-b border-surface-border">
      ${studioMark(20)}<span class="text-ui-lg font-ui-strong">Studio</span>
    </header>
    <nav class="flex flex-col gap-space-1 p-space-2">
      <span class="flex items-center h-row px-space-2 rounded-control-sm bg-accent-subtle text-text">Foundations</span>
      <span class="flex items-center h-row px-space-2 rounded-control-sm text-text-muted">Components</span>
      <span class="flex items-center h-row px-space-2 rounded-control-sm text-text-muted">Sketches</span>
    </nav>
  </aside>
</div>`;

export default definePart<{ view: View }>({
  note: 'Pilot — ein eigenständiger Agentencharakter aus einer schrägen Feder- und Cursor-Silhouette. Zwei ausgesparte Augen geben dem Gestaltungswerkzeug Persönlichkeit; bewusst spielerischer.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  states: { sizes: { view: 'sizes' }, sidebar: { view: 'sidebar' } },
  render: ({ view }) => drawing({ body: view === 'sizes' ? sizes : sidebar }),
});
