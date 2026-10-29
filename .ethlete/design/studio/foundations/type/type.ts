import { definePart, drawing, html } from '@design-system';
import tokens from './type.css?inline';

const names = [...tokens.matchAll(/^\s*--([\w-]+):/gm)].map(([, name]) => name ?? '');

const steps = ['xs', 'sm', 'md', 'lg', 'xl'];

const sampleOf = (name: string) => {
  if (name.startsWith('font-')) return html`<span style="font-family: var(--${name})">Aa 0123 {}</span>`;
  if (name.startsWith('weight-')) return html`<span style="font-weight: var(--${name})">Merge sketch</span>`;
  if (name.endsWith('-line'))
    return html`<span class="ty-line" style="font-size: var(--${name.slice(0, -5)}); line-height: var(--${name})"
      >Pick variant</span
    >`;

  return html`<span style="font-size: var(--${name}); line-height: var(--${name}-line)">Pick variant</span>`;
};

const tokenRow = (name: string) =>
  html`<li class="ty-row">
    <span class="ty-name">--${name}</span><span class="ty-value" data-token="${name}"></span
    ><span class="ty-sample">${sampleOf(name)}</span>
  </li>`;

const typeSample = (step: string) =>
  html`<div class="ty-step">
    <span class="ty-name">--text-${step}</span
    ><span class="ty-value"
      ><span data-token="text-${step}"></span> / <span data-token="text-${step}-line"></span
    ></span>
    <span class="ty-step-text ty-line" style="font-size: var(--text-${step}); line-height: var(--text-${step}-line)"
      >foundations/type · Pick variant</span
    >
  </div>`;

const fillValues = (root: HTMLElement) => {
  const style = getComputedStyle(root);
  const probe = root.querySelector<HTMLElement>('.ty-probe');

  for (const cell of root.querySelectorAll<HTMLElement>('[data-token]')) {
    const value = style.getPropertyValue(`--${cell.dataset['token']}`).trim();
    let pixels = '';

    if (probe && /^[\d.]+rem$/.test(value)) {
      probe.style.width = value;
      pixels = ` · ${Math.round(probe.getBoundingClientRect().width * 10) / 10}px`;
    }

    cell.textContent = value + pixels;
  }
};

export default definePart({
  note: 'The Studio type scale, fonts and weights on their own sheet, split from foundations/tokens.',
  madeBy: ['claude-opus-5-5'],
  states: { scale: {} },
  render: () =>
    drawing({
      body: html`<div class="ty-root">
        <h2 class="ty-title">Type scale</h2>
        <section class="ty-panel ty-stack">${steps.map(typeSample).join('')}</section>
        <ul class="ty-panel ty-list">
          ${names.map(tokenRow).join('')}
        </ul>
        <span class="ty-probe"></span>
      </div>`,
      setup: fillValues,
      styles: `${tokens}
        .ty-root { position: relative; display: flex; flex-direction: column; gap: var(--space-4); width: 960px; padding: var(--space-6); box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font-family: var(--font-ui); font-size: var(--text-md); line-height: var(--text-md-line); }
        .ty-title { margin: 0; font-size: var(--text-xl); line-height: var(--text-xl-line); font-weight: var(--weight-strong); }
        .ty-panel { margin: 0; padding: var(--space-4); background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-control-lg); }
        .ty-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-1); }
        .ty-row { display: grid; grid-template-columns: 200px 240px 1fr; align-items: center; gap: var(--space-3); min-height: var(--row); }
        .ty-name { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); color: var(--text-muted); }
        .ty-value { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); overflow-wrap: anywhere; }
        .ty-sample { display: flex; align-items: center; min-width: 0; }
        .ty-stack { display: flex; flex-direction: column; gap: var(--space-3); }
        .ty-step { display: grid; grid-template-columns: 120px 300px 1fr; align-items: center; gap: var(--space-3); }
        .ty-step-text { min-width: 0; }
        .ty-line { background: var(--accent-subtle); }
        .ty-probe { position: absolute; left: 0; top: 0; height: 0; visibility: hidden; }
      `,
    }),
});
