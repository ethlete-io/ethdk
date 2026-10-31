import { Drawing, html } from './define-call';
import { svgAsset } from './svg-asset';

export type IconSheetIcon = {
  name: string;
  svg: string;
  grid?: number;
  padding?: number;
};

export type IconSheetOptions = {
  view: 'catalogue' | 'construction';
  title: string;
  note?: string;
  icons: IconSheetIcon[];
  sizes?: number[];
  size?: number;
  columns?: number;
};

const SHEET_STYLES = `
  .ics-root { display: flex; flex-direction: column; gap: var(--space-4, 1.6rem); padding: var(--space-6, 2.4rem); background: var(--surface, oklch(0.17 0 0)); color: var(--text, oklch(0.94 0 0)); font-family: var(--font-ui, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); font-size: var(--text-md, 1.3rem); line-height: var(--text-md-line, 1.8rem); }
  .ics-root svg { display: block; }
  .ics-title { margin: 0; font-size: var(--text-xl, 1.7rem); line-height: var(--text-xl-line, 2.2rem); font-weight: var(--weight-strong, 600); }
  .ics-note { margin: 0; max-width: 64rem; color: var(--text-muted, oklch(0.72 0 0)); }
  .ics-group { margin: 0; font-size: var(--text-lg, 1.5rem); line-height: var(--text-lg-line, 2rem); font-weight: var(--weight-strong, 600); }
  .ics-muted { color: var(--text-muted, oklch(0.72 0 0)); }
  .ics-name { justify-self: start; font-family: var(--font-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace); color: var(--text-muted, oklch(0.72 0 0)); }
  .ics-catalogue { display: grid; align-items: center; justify-items: center; column-gap: var(--space-4, 1.6rem); row-gap: var(--space-2, 0.8rem); }
  .ics-size { font-size: var(--text-sm, 1.15rem); }
  .ics-cell { display: flex; }
  .ics-construction { display: grid; gap: var(--space-5, 2rem); }
  .ics-item { display: flex; flex-direction: column; align-items: center; gap: var(--space-2, 0.8rem); }
  .ics-frame { position: relative; display: flex; border: 1px solid var(--surface-border, oklch(0.34 0 0)); background: var(--surface, oklch(0.17 0 0)); }
  .ics-icon { position: relative; }
  .ics-guides { position: absolute; inset: 0; width: 100%; height: 100%; color: var(--accent, oklch(0.7 0.15 250)); pointer-events: none; }
  .ics-guides path, .ics-guides rect { vector-effect: non-scaling-stroke; stroke-width: 1px; }
  .ics-pixels { opacity: 0.18; }
  .ics-key { opacity: 0.7; stroke-dasharray: 4 3; }
`;

const VIEW_BOX = /\bviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/u;

const gridOf = (icon: IconSheetIcon) => {
  if (icon.grid) return icon.grid;
  const [, width, height] = VIEW_BOX.exec(icon.svg) ?? [];
  if (!width || !height) throw new Error(`iconSheet: "${icon.name}" has no viewBox, so it needs a grid`);

  return Math.max(Number(width), Number(height));
};

const groupsOf = (icons: IconSheetIcon[]) => {
  const groups = new Map<number, IconSheetIcon[]>();
  for (const icon of icons) groups.set(gridOf(icon), [...(groups.get(gridOf(icon)) ?? []), icon]);

  return [...groups];
};

const gridLabel = (grid: number) => (grid <= 48 ? `${grid} px grid` : `${grid}-unit grid`);

const guides = (grid: number, { cls, paths }: { cls: string; paths: string }) =>
  `<svg class="ics-guides ${cls}" viewBox="0 0 ${grid} ${grid}" fill="none" stroke="currentColor" aria-hidden="true" data-grid="${grid}">${paths}</svg>`;

const pixelLines = (grid: number) => {
  const step = grid > 48 ? grid / 16 : 1;
  const lines = Array.from({ length: Math.round(grid / step) - 1 }, (_, index) => (index + 1) * step);

  return guides(grid, {
    cls: 'ics-pixels',
    paths: lines.map((at) => `<path d="M${at} 0V${grid}M0 ${at}H${grid}"/>`).join(''),
  });
};

const keyLines = (grid: number, padding: number) =>
  guides(grid, {
    cls: 'ics-key',
    paths: `<path d="M${grid / 2} 0V${grid}M0 ${grid / 2}H${grid}"/><rect x="${padding}" y="${padding}" width="${grid - 2 * padding}" height="${grid - 2 * padding}"/>`,
  });

const drawIcon = (icon: IconSheetIcon, { size, cls }: { size: number; cls?: string }) =>
  svgAsset(icon.svg, { size, class: cls, attrs: { 'aria-hidden': 'true' } });

const catalogue = (icons: IconSheetIcon[], sizes: number[]) =>
  html`<div
    class="ics-catalogue"
    style="grid-template-columns: max-content repeat(${sizes.length}, minmax(var(--space-7, 3.2rem), max-content))"
  >
    <span></span>
    ${sizes.map((size) => html`<span class="ics-size ics-muted">${size} px</span>`).join('')}
    ${icons
      .map(
        (icon) =>
          html`<span class="ics-name">${icon.name}</span>${sizes
              .map((size) => html`<span class="ics-cell">${drawIcon(icon, { size })}</span>`)
              .join('')}`,
      )
      .join('')}
  </div>`;

const construction = (
  icons: IconSheetIcon[],
  { grid, size, columns }: { grid: number; size: number; columns: number },
) =>
  html`<div class="ics-construction" style="grid-template-columns: repeat(${columns}, max-content)">
    ${icons
      .map(
        (icon) =>
          html`<div class="ics-item">
            <span class="ics-frame"
              >${pixelLines(grid)}${drawIcon(icon, { size, cls: 'ics-icon' })}${keyLines(grid, icon.padding ?? grid / 8)}</span
            >
            <span class="ics-name">${icon.name}</span>
          </div>`,
      )
      .join('')}
  </div>`;

/**
 * Draws a foundation sheet of icons. `catalogue` shows every icon at each of `sizes` with its name; `construction` shows
 * each icon `size` px large on its grid, with the grid lines, the centre lines and the padding box. An icon's grid is its
 * `grid`, else the larger side of its viewBox; its padding is `padding` grid units, `grid / 8` by default.
 * Icons on different grids are drawn in one group per grid.
 */
export const iconSheet = ({
  view,
  title,
  note,
  icons,
  sizes = [16, 24, 32],
  size = 96,
  columns = 5,
}: IconSheetOptions): Drawing => {
  const groups = groupsOf(icons);
  const labelled = groups.length > 1;

  return {
    body: html`<div class="ics-root">
      <h2 class="ics-title">${title}</h2>
      ${note && html`<p class="ics-note">${note}</p>`}
      ${groups
        .map(
          ([grid, members]) =>
            html`${labelled && html`<h3 class="ics-group">${gridLabel(grid)}</h3>`}${
              view === 'catalogue' ? catalogue(members, sizes) : construction(members, { grid, size, columns })
            }`,
        )
        .join('')}
    </div>`,
    styles: SHEET_STYLES,
  };
};
