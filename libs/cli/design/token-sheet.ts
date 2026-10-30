import { Drawing, html } from './define-call';

export type TokenSheetOptions = {
  title: string;
  css: string;
  sample: string;
  sampleOf: (name: string) => string;
  sampleClass?: string;
  only?: (name: string) => boolean;
  pixels?: boolean;
  styles?: string;
  setup?: (root: HTMLElement) => void;
};

const SHEET_STYLES = `
  .ts-root { position: relative; display: flex; flex-direction: column; gap: var(--space-4, 1.6rem); width: 960px; padding: var(--space-6, 2.4rem); box-sizing: border-box; background: var(--surface, oklch(0.17 0 0)); color: var(--text, oklch(0.94 0 0)); font-family: var(--font-ui, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif); font-size: var(--text-md, 1.3rem); line-height: var(--text-md-line, 1.8rem); }
  .ts-title { margin: 0; font-size: var(--text-xl, 1.7rem); line-height: var(--text-xl-line, 2.2rem); font-weight: var(--weight-strong, 600); }
  .ts-panel { margin: 0; padding: var(--space-4, 1.6rem); background: var(--surface, oklch(0.17 0 0)); border: 1px solid var(--surface-border, oklch(0.34 0 0)); border-radius: var(--radius-control-lg, 1rem); }
  .ts-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-1, 0.4rem); }
  .ts-row { display: grid; grid-template-columns: 200px 240px 1fr; align-items: center; gap: var(--space-3, 1.2rem); min-height: var(--row, 2.4rem); }
  .ts-name { font-family: var(--font-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace); font-size: var(--text-sm, 1.15rem); line-height: var(--text-sm-line, 1.6rem); color: var(--text-muted, oklch(0.72 0 0)); }
  .ts-value { font-family: var(--font-code, ui-monospace, "SF Mono", Menlo, Consolas, monospace); font-size: var(--text-sm, 1.15rem); line-height: var(--text-sm-line, 1.6rem); overflow-wrap: anywhere; }
  .ts-sample { display: flex; align-items: center; min-width: 0; }
  .ts-probe { position: absolute; left: 0; top: 0; height: 0; visibility: hidden; }
`;

const tokenNamesOf = (css: string, only: (name: string) => boolean) => [
  ...new Set([...css.matchAll(/^\s*--([\w-]+):/gmu)].map(([, name]) => name ?? '').filter(only)),
];

const fillTokenValues = (root: HTMLElement, pixels: boolean) => {
  const style = getComputedStyle(root);
  const probe = root.querySelector<HTMLElement>('.ts-probe');

  for (const cell of root.querySelectorAll<HTMLElement>('[data-token]')) {
    const value = style.getPropertyValue(`--${cell.dataset['token']}`).trim();
    let suffix = '';
    if (pixels && probe && /^[\d.]+rem$/u.test(value)) {
      probe.style.width = value;
      suffix = ` · ${Math.round(probe.getBoundingClientRect().width * 10) / 10}px`;
    }
    cell.textContent = value + suffix;
  }
};

/**
 * Draws a foundation sheet: a sample panel, then one row per custom property declared in `css` (narrowed by `only`)
 * with its value as the drawing resolves it, in px too for rem values when `pixels` is set.
 */
export const tokenSheet = ({
  title,
  css,
  sample,
  sampleOf,
  sampleClass = '',
  only = () => true,
  pixels = false,
  styles = '',
  setup,
}: TokenSheetOptions): Drawing => ({
  body: html`<div class="ts-root">
    <h2 class="ts-title">${title}</h2>
    <section class="ts-panel ${sampleClass}">${sample}</section>
    <ul class="ts-panel ts-list">
      ${tokenNamesOf(css, only)
        .map(
          (name) =>
            html`<li class="ts-row">
              <span class="ts-name">--${name}</span><span class="ts-value" data-token="${name}"></span
              ><span class="ts-sample">${sampleOf(name)}</span>
            </li>`,
        )
        .join('')}
    </ul>
    <span class="ts-probe"></span>
  </div>`,
  styles: `${SHEET_STYLES}${styles}`,
  setup: [(root: HTMLElement) => fillTokenValues(root, pixels), ...(setup ? [setup] : [])],
});
