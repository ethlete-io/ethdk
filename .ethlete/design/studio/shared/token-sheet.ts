import { html } from '@design-system';

export const tokenSheetStyles = `
  .ts-root { position: relative; display: flex; flex-direction: column; gap: var(--space-4); width: 960px; padding: var(--space-6); box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font-family: var(--font-ui); font-size: var(--text-md); line-height: var(--text-md-line); }
  .ts-title { margin: 0; font-size: var(--text-xl); line-height: var(--text-xl-line); font-weight: var(--weight-strong); }
  .ts-panel { margin: 0; padding: var(--space-4); background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-control-lg); }
  .ts-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-1); }
  .ts-row { display: grid; grid-template-columns: 200px 240px 1fr; align-items: center; gap: var(--space-3); min-height: var(--row); }
  .ts-name { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); color: var(--text-muted); }
  .ts-value { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); overflow-wrap: anywhere; }
  .ts-sample { display: flex; align-items: center; min-width: 0; }
  .ts-probe { position: absolute; left: 0; top: 0; height: 0; visibility: hidden; }
`;

export const tokenSheet = ({
  title,
  sample,
  names,
  sampleOf,
  sampleClass = '',
}: {
  title: string;
  sample: string;
  names: string[];
  sampleOf: (name: string) => string;
  sampleClass?: string;
}) =>
  html`<div class="ts-root">
    <h2 class="ts-title">${title}</h2>
    <section class="ts-panel ${sampleClass}">${sample}</section>
    <ul class="ts-panel ts-list">
      ${names
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
  </div>`;

export const fillTokenValues = (root: HTMLElement, pixels = false) => {
  const style = getComputedStyle(root);
  const probe = root.querySelector<HTMLElement>('.ts-probe');

  for (const cell of root.querySelectorAll<HTMLElement>('[data-token]')) {
    const value = style.getPropertyValue(`--${cell.dataset['token']}`).trim();
    let suffix = '';
    if (pixels && probe && /^[\d.]+rem$/.test(value)) {
      probe.style.width = value;
      suffix = ` · ${Math.round(probe.getBoundingClientRect().width * 10) / 10}px`;
    }
    cell.textContent = value + suffix;
  }
};
