import { definePart, drawing, html, logoSheet, svgAsset } from '@design-system';
import mark from '@assets/studio-mark.svg?raw';
import markLine from '@assets/studio-mark-line.svg?raw';

type View = 'sizes' | 'sidebar';

export const studioMark = (size: number) => svgAsset(mark, { size });

/** The mark as a single line in `currentColor`, without the tile, for the app rail. */
export const studioMarkLine = (size: number) => svgAsset(markLine, { size });

const sizes = logoSheet({
  marks: [
    { title: 'Mark at app-icon sizes', svg: mark, sizes: [16, 32, 512], onLight: [16, 32] },
    { title: 'Line mark in the rail', svg: markLine, sizes: [16, 24, 32] },
  ],
});

const sidebar = html`<div class="flex flex-col gap-space-4 p-space-6 bg-et-surface-bg text-text font-ui text-ui-md">
  <aside
    class="flex flex-col w-60 h-80 bg-et-surface-bg border border-et-surface-border rounded-control-lg overflow-hidden"
  >
    <header class="flex items-center gap-space-2 h-11 px-space-3 border-b border-et-surface-border">
      ${studioMark(20)}<span class="text-ui-lg font-ui-strong">Studio</span>
    </header>
    <nav class="flex flex-col gap-space-1 p-space-2">
      <span class="flex items-center h-row px-space-2 rounded-control-sm bg-et-theme/20 text-text">Foundations</span>
      <span class="flex items-center h-row px-space-2 rounded-control-sm text-text-muted">Components</span>
      <span class="flex items-center h-row px-space-2 rounded-control-sm text-text-muted">Sketches</span>
    </nav>
  </aside>
</div>`;

export default definePart<{ view: View }>({
  note: 'Pilot — ein eigenständiger Agentencharakter aus einer schrägen Feder- und Cursor-Silhouette. Zwei ausgesparte Augen geben dem Gestaltungswerkzeug Persönlichkeit; bewusst spielerischer.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  states: { sizes: { view: 'sizes' }, sidebar: { view: 'sidebar' } },
  render: ({ view }) => (view === 'sizes' ? sizes : drawing({ body: sidebar })),
});
