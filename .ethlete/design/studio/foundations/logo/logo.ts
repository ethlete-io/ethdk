import { definePart, drawing, html, logoSheet, svgAsset } from '@design-system';
import mark from '@assets/studio-mark.svg?raw';
import markLine from '@assets/studio-mark-line.svg?raw';
import appIcon from '@assets/studio-app-icon.svg?raw';
import styles from './logo.css?inline';

type View =
  | 'sizes'
  | 'sidebar'
  | 'app-icon'
  | 'anatomy'
  | 'clear-space'
  | 'minimum-size'
  | 'colour-variants'
  | 'misuse'
  | 'motion';

export const studioMark = (size: number) => svgAsset(mark, { size });

/** The mark as a single line in `currentColor`, without the tile, for the app rail. */
export const studioMarkLine = (size: number) => svgAsset(markLine, { size });

const sizes = logoSheet({
  marks: [
    { title: 'Mark at app-icon sizes', svg: mark, sizes: [16, 32, 512], onLight: [16, 32] },
    { title: 'Line mark in the rail', svg: markLine, sizes: [16, 24, 32] },
  ],
});

const appIconSheet = logoSheet({
  marks: [{ title: 'App icon', svg: appIcon, sizes: [16, 32, 64, 128, 256], onLight: [32, 64] }],
});

const sidebar = html`<div
  class="flex flex-col gap-space-4 p-space-6 bg-et-surface-background text-text font-ui text-ui-md"
>
  <aside class="flex flex-col w-60 h-80 border border-et-surface-border rounded-control-lg overflow-hidden">
    <header class="flex items-center gap-space-2 h-11 px-space-3 border-b border-et-surface-border">
      ${studioMark(20)}<span class="text-ui-lg font-ui-strong">Studio</span>
    </header>
    <nav class="flex flex-col gap-space-1 p-space-2">
      <span class="flex items-center h-row px-space-2 rounded-control-sm bg-et-tone-fill/20 text-text"
        >Foundations</span
      >
      <span class="flex items-center h-row px-space-2 rounded-control-sm text-text-muted">Components</span>
      <span class="flex items-center h-row px-space-2 rounded-control-sm text-text-muted">Sketches</span>
    </nav>
  </aside>
</div>`;

const SILHOUETTE =
  'M11.5 5.5H24.1C26 5.5 27 6.9 26.4 8.7L22.8 20.9C22.5 22 21.8 22.9 20.8 23.4L8 28L9 21.6L5.9 17.4C5.2 16.5 5.2 15.2 5.9 14.2L9.4 6.8C9.8 6 10.6 5.5 11.5 5.5Z';
const EYE_LEFT =
  'M12.8 11.5C12 11.3 11.2 11.8 11 12.6L10.2 15.7C10 16.5 10.5 17.3 11.3 17.5C12.1 17.7 12.9 17.2 13.1 16.4L13.9 13.3C14.1 12.5 13.6 11.7 12.8 11.5Z';
const EYE_RIGHT =
  'M20.1 10.6C19.3 10.4 18.5 10.9 18.3 11.7L17.5 14.8C17.3 15.6 17.8 16.4 18.6 16.6C19.4 16.8 20.2 16.3 20.4 15.5L21.2 12.4C21.4 11.6 20.9 10.8 20.1 10.6Z';

/** The mark with blinking eyes on a tile coloured by `--st-tile` and `--st-on-tile`, the busy state of a tile that shows the mark. */
export const studioBusyMark = (
  size: number,
) => `<svg data-et-drawing class="lg-busy block" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true">
  <rect width="32" height="32" rx="8" fill="var(--st-tile)" />
  <g class="lg-busy-bubble" color="var(--st-on-tile)">
    <path fill="currentColor" d="${SILHOUETTE}" />
    <path class="lg-busy-eye" fill="var(--st-tile)" d="${EYE_LEFT}" />
    <path class="lg-busy-eye" fill="var(--st-tile)" d="${EYE_RIGHT}" />
  </g>
</svg>`;

const tileVars =
  'style="--st-tile: var(--accent, var(--et-tone-fill)); --st-on-tile: var(--on-accent, var(--surface-bg))"';

const legend = (rows: [string, string][]) =>
  html`<div class="lg-legend">
    ${rows
      .map(
        ([name, text]) =>
          html`<div class="lg-legend-row">
            <span class="lg-legend-name">${name}</span><span class="lg-caption">${text}</span>
          </div>`,
      )
      .join('')}
  </div>`;

const anatomy = html`<div class="lg-section">
  <div class="lg-row">
    ${studioMark(192)}
    ${legend([
      ['Tile', 'Rounded square, corner radius one quarter of the width, in the accent colour.'],
      ['Silhouette', 'A slanted quill and cursor in one shape, cut from the tile colour in the on-accent colour.'],
      ['Eyes', 'Two slanted cut-outs that give the tool its character; they stay open at every size.'],
    ])}
  </div>
</div>`;

const clearSpace = html`<div class="lg-section">
  <div class="lg-row">
    <div class="lg-clear"><span class="lg-clear-label">x</span>${studioMark(96)}</div>
    <span class="lg-caption"
      >x is one quarter of the tile width. Keep that space free of text, edges and other marks on every side.</span
    >
  </div>
</div>`;

const minimumSize = html`<div class="lg-section">
  <div class="lg-row">
    ${[12, 16, 20, 24, 32]
      .map((size) => html`<div class="lg-cell">${studioMark(size)}<span class="lg-caption">${size} px</span></div>`)
      .join('')}
  </div>
  <span class="lg-caption"
    >The tiled mark is never smaller than 16 px; below that the eyes close up. At 12 px it is shown only to mark the
    limit.</span
  >
</div>`;

const colourVariants = html`<div class="lg-section">
  <div class="lg-row">
    <div class="lg-cell">
      <div class="lg-plate">${studioMark(64)}</div>
      <span class="lg-caption">Tile on dark</span>
    </div>
    <div class="lg-cell">
      <div class="lg-plate lg-plate--light">${studioMark(64)}</div>
      <span class="lg-caption">Tile on light</span>
    </div>
    <div class="lg-cell">
      <div class="lg-plate">${studioMarkLine(64)}</div>
      <span class="lg-caption">Line on dark</span>
    </div>
    <div class="lg-cell">
      <div class="lg-plate lg-plate--light">${studioMarkLine(64)}</div>
      <span class="lg-caption">Line on light</span>
    </div>
  </div>
  <span class="lg-caption"
    >The tile keeps the accent colour on both surfaces. The line mark takes the text colour and has no tile.</span
  >
</div>`;

const misuse = html`<div class="lg-section">
  <div class="lg-row">
    <div class="lg-cell">
      <span class="lg-misuse" style="transform: rotate(15deg)">${studioMark(64)}</span
      ><span class="lg-caption">Do not rotate</span>
    </div>
    <div class="lg-cell">
      <span class="lg-misuse" style="transform: scaleX(1.5)">${studioMark(64)}</span
      ><span class="lg-caption">Do not stretch</span>
    </div>
    <div class="lg-cell">
      <span class="lg-misuse" style="filter: hue-rotate(120deg)">${studioMark(64)}</span
      ><span class="lg-caption">Do not recolour</span>
    </div>
    <div class="lg-cell">
      <span class="lg-misuse" style="opacity: 0.35">${studioMark(64)}</span><span class="lg-caption">Do not fade</span>
    </div>
  </div>
</div>`;

const motion = html`<div class="lg-section">
  <div class="lg-row">
    <div class="lg-cell">
      <div class="lg-plate" ${tileVars}>${studioBusyMark(96)}</div>
      <span class="lg-caption">Busy</span>
    </div>
    <span class="lg-caption"
      >While work runs the silhouette bobs by 0.6 px and the eyes blink, one cycle every thirteen state durations. Under
      reduced motion the mark stands still.</span
    >
  </div>
</div>`;

const sections = {
  anatomy,
  'clear-space': clearSpace,
  'minimum-size': minimumSize,
  'colour-variants': colourVariants,
  misuse,
  motion,
};

export default definePart<{ view: View }>({
  note: 'Pilot — ein eigenständiger Agentencharakter aus einer schrägen Feder- und Cursor-Silhouette. Zwei ausgesparte Augen geben dem Gestaltungswerkzeug Persönlichkeit; bewusst spielerischer.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'gpt-6'],
  styles,
  states: {
    sizes: { view: 'sizes' },
    sidebar: { view: 'sidebar' },
    'app-icon': { view: 'app-icon' },
    anatomy: { view: 'anatomy' },
    'clear-space': { view: 'clear-space' },
    'minimum-size': { view: 'minimum-size' },
    'colour-variants': { view: 'colour-variants' },
    misuse: { view: 'misuse' },
    motion: { view: 'motion' },
  },
  describe: {
    sizes:
      'The tiled mark at 16, 32 and 512 px and the line mark at 16 to 32 px; check that the eyes stay open at 16 px on dark and light.',
    sidebar:
      'The mark at 20 px beside Studio in a sidebar header; check that it sits level with the word and the header keeps its height.',
    'app-icon':
      'The app icon from 16 to 256 px on dark and light; check that the silhouette stays readable at 16 px and the tile corners stay even.',
    anatomy: 'The mark at 192 px with its three parts named; check that tile, silhouette and eyes each have one line.',
    'clear-space':
      'The mark inside a dashed clear-space box of one quarter of its width; check the box sits evenly on all four sides.',
    'minimum-size': 'The tiled mark from 12 to 32 px; check that 16 px is the smallest size the text calls readable.',
    'colour-variants':
      'The tile and the line mark on dark and light; check that the tile keeps its accent and the line follows the text colour.',
    misuse:
      'Four wrong uses of the mark (rotated, stretched, recoloured, faded), each outlined; check the outline reads as a warning.',
    motion: 'The busy mark blinking on its tile; check the silhouette bobs, the eyes blink and nothing else moves.',
  },
  render: ({ view }) =>
    view === 'sizes'
      ? sizes
      : view === 'app-icon'
        ? appIconSheet
        : view === 'sidebar'
          ? drawing({ body: sidebar })
          : drawing({ body: sections[view] }),
});
