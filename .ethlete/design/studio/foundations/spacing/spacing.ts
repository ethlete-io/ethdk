import { definePart, drawing, html } from '@design-system';
import tokens from './spacing.css?inline';

const names = [...tokens.matchAll(/^\s*--([\w-]+):/gm)].map(([, name]) => name ?? '');

const sampleOf = (name: string) => {
  if (name.startsWith('space-')) return html`<span class="sp-bar" style="width: var(--${name})"></span>`;
  if (name.startsWith('radius-')) return html`<span class="sp-radius" style="border-radius: var(--${name})"></span>`;

  return html`<span class="sp-height" style="height: var(--${name})">${name}</span>`;
};

const tokenRow = (name: string) =>
  html`<li class="sp-row">
    <span class="sp-name">--${name}</span><span class="sp-value" data-token="${name}"></span
    ><span class="sp-sample">${sampleOf(name)}</span>
  </li>`;

const sample = html`<div class="sp-cluster">
  <span class="sp-height" style="height: var(--control-sm)">control-sm</span>
  <span class="sp-height" style="height: var(--control-md)">control-md</span>
  <span class="sp-height sp-height--row" style="height: var(--row)">row</span>
  <span class="sp-stack">
    <span class="sp-gap" style="gap: var(--space-1)"><i></i><i></i><i></i>space-1</span>
    <span class="sp-gap" style="gap: var(--space-3)"><i></i><i></i><i></i>space-3</span>
  </span>
</div>`;

const fillValues = (root: HTMLElement) => {
  const style = getComputedStyle(root);
  const probe = root.querySelector<HTMLElement>('.sp-probe');

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
  note: 'The Studio spacing, radius and control heights on their own sheet, split from foundations/tokens.',
  madeBy: ['claude-opus-5-5'],
  states: { scale: {} },
  render: () =>
    drawing({
      body: html`<div class="sp-root">
        <h2 class="sp-title">Spacing, radius and heights</h2>
        <section class="sp-panel">${sample}</section>
        <ul class="sp-panel sp-list">
          ${names.map(tokenRow).join('')}
        </ul>
        <span class="sp-probe"></span>
      </div>`,
      setup: fillValues,
      styles: `${tokens}
        .sp-root { position: relative; display: flex; flex-direction: column; gap: var(--space-4); width: 960px; padding: var(--space-6); box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font-family: var(--font-ui); font-size: var(--text-md); line-height: var(--text-md-line); }
        .sp-title { margin: 0; font-size: var(--text-xl); line-height: var(--text-xl-line); font-weight: var(--weight-strong); }
        .sp-panel { margin: 0; padding: var(--space-4); background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-control-lg); }
        .sp-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-1); }
        .sp-row { display: grid; grid-template-columns: 200px 240px 1fr; align-items: center; gap: var(--space-3); min-height: var(--row); }
        .sp-name { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); color: var(--text-muted); }
        .sp-value { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); overflow-wrap: anywhere; }
        .sp-sample { display: flex; align-items: center; min-width: 0; }
        .sp-cluster { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-5); }
        .sp-stack { display: flex; flex-direction: column; gap: var(--space-3); }
        .sp-bar { display: block; height: var(--space-2); background: var(--accent); border-radius: 2px; }
        .sp-radius { width: 40px; height: 40px; background: var(--surface-raised); border: 1px solid var(--accent); }
        .sp-height { display: inline-flex; align-items: center; padding: 0 var(--space-2); box-sizing: border-box; background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .sp-height--row { min-width: 200px; background: var(--accent-subtle); color: var(--text); }
        .sp-gap { display: flex; align-items: center; font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .sp-gap i { width: var(--space-4); height: var(--space-4); background: var(--accent); border-radius: 2px; }
        .sp-probe { position: absolute; left: 0; top: 0; height: 0; visibility: hidden; }
      `,
    }),
});
