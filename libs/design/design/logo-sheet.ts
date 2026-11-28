import { Drawing, html } from './define-call';
import { svgAsset } from './svg-asset';

export type LogoSheetMark = {
  title: string;
  svg: string;
  sizes: number[];
  onLight?: number[];
};

export type LogoSheetOptions = {
  marks: LogoSheetMark[];
};

const SHEET_STYLES = `
  .lgs-root { display: flex; flex-direction: column; gap: var(--space-4, 1.6rem); padding: var(--space-6, 2.4rem); background: var(--surface, oklch(0.17 0 0)); color: var(--text, oklch(0.94 0 0)); font-family: var(--font-ui, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); font-size: var(--text-md, 1.3rem); line-height: var(--text-md-line, 1.8rem); }
  .lgs-root svg { display: block; }
  .lgs-title { margin: 0; font-size: var(--text-xl, 1.7rem); line-height: var(--text-xl-line, 2.2rem); font-weight: var(--weight-strong, 600); }
  .lgs-row { display: flex; align-items: flex-end; gap: var(--space-6, 2.4rem); }
  .lgs-item { display: flex; flex-direction: column; align-items: center; gap: var(--space-2, 0.8rem); }
  .lgs-label { font-family: var(--font-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace); font-size: var(--text-xs, 1rem); line-height: var(--text-xs-line, 1.4rem); color: var(--text-muted, oklch(0.72 0 0)); }
  .lgs-plate { display: flex; align-items: center; gap: var(--space-3, 1.2rem); padding: var(--space-2, 0.8rem) var(--space-3, 1.2rem); border-radius: var(--radius-control-md, 0.6rem); background: var(--text, oklch(0.94 0 0)); }
`;

const item = (content: string, label: string) =>
  html`<div class="lgs-item">${content}<span class="lgs-label">${label}</span></div>`;

/**
 * Draws a `foundations/logo` part: one row per mark with its `title`, the mark at each of its `sizes` in px, and, when
 * `onLight` lists sizes, the mark at those sizes on a light bar.
 */
export const logoSheet = ({ marks }: LogoSheetOptions): Drawing => ({
  body: html`<div class="lgs-root">
    ${marks
      .map(
        ({ title, svg, sizes, onLight }) =>
          html`<h2 class="lgs-title">${title}</h2>
            <div class="lgs-row">
              ${sizes.map((size) => item(svgAsset(svg, { size }), `${size} px`)).join('')}
              ${
                !!onLight?.length &&
                item(
                  html`<div class="lgs-plate">${onLight.map((size) => svgAsset(svg, { size })).join('')}</div>`,
                  'on a light bar',
                )
              }
            </div>`,
      )
      .join('')}
  </div>`,
  styles: SHEET_STYLES,
});
