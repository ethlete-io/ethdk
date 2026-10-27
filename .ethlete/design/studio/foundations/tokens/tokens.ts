import { definePart, drawing, html } from '@design-system';
import tokens from './tokens.css?inline';

type Group = 'surfaces' | 'accent' | 'type' | 'spacing';

const groups: Record<Group, { title: string; owns: (name: string) => boolean }> = {
  surfaces: { title: 'Surfaces and text', owns: (name) => /^surface(-|$)/.test(name) || /^text(-muted)?$/.test(name) },
  accent: { title: 'Accent', owns: (name) => /^(accent|on-accent|focus-ring)/.test(name) },
  type: { title: 'Type scale', owns: (name) => /^(font-|weight-|text-(xs|sm|md|lg|xl))/.test(name) },
  spacing: { title: 'Spacing, radius and heights', owns: (name) => /^(space-|radius-|control-|row$)/.test(name) },
};

const namesOf = (group: Group) => [
  ...new Set([...tokens.matchAll(/^\s*--([\w-]+):/gm)].map(([, name]) => name ?? '').filter(groups[group].owns)),
];

const surfaces = ['surface-sunken', 'surface', 'surface-raised', 'surface-overlay'];

const steps = ['xs', 'sm', 'md', 'lg', 'xl'];

const sampleOf = (name: string) => {
  if (name === 'surface-shadow') return html`<span class="tk-shadow"></span>`;
  if (name === 'focus-ring') return html`<span class="tk-ring">Focus</span>`;
  if (name === 'on-accent') return html`<span class="tk-fill">Merge</span>`;
  if (groups.surfaces.owns(name) || groups.accent.owns(name))
    return html`<span class="tk-swatch" style="background: var(--${name})"></span>`;
  if (name.startsWith('font-')) return html`<span style="font-family: var(--${name})">Aa 0123 {}</span>`;
  if (name.startsWith('weight-')) return html`<span style="font-weight: var(--${name})">Merge sketch</span>`;
  if (name.endsWith('-line'))
    return html`<span class="tk-line" style="font-size: var(--${name.slice(0, -5)}); line-height: var(--${name})"
      >Pick variant</span
    >`;
  if (name.startsWith('text-'))
    return html`<span style="font-size: var(--${name}); line-height: var(--${name}-line)">Pick variant</span>`;
  if (name.startsWith('space-')) return html`<span class="tk-bar" style="width: var(--${name})"></span>`;
  if (name.startsWith('radius-')) return html`<span class="tk-radius" style="border-radius: var(--${name})"></span>`;

  return html`<span class="tk-height" style="height: var(--${name})">${name}</span>`;
};

const tokenRow = (name: string) =>
  html`<li class="tk-row">
    <span class="tk-name">--${name}</span><span class="tk-value" data-token="${name}"></span
    ><span class="tk-sample">${sampleOf(name)}</span>
  </li>`;

const surfaceCard = (surface: string) =>
  html`<div class="tk-surface" style="background: var(--${surface})">
    <span class="tk-surface-name">${surface}</span>
    <span>Text on ${surface}</span>
    <span class="tk-muted">Muted on ${surface}</span>
  </div>`;

const accentCard = (surface: string) =>
  html`<div class="tk-surface" style="background: var(--${surface})">
    <span class="tk-surface-name">${surface}</span>
    <span class="tk-cluster"><span class="tk-fill">Merge</span><span class="tk-fill tk-fill--hover">Hover</span></span>
    <span class="tk-ink">Accent text link</span>
    <span class="tk-subtle">Selected row</span>
    <span class="tk-ring">Focused</span>
  </div>`;

const typeSample = (step: string) =>
  html`<div class="tk-type">
    <span class="tk-name">--text-${step}</span
    ><span class="tk-value"
      ><span data-token="text-${step}"></span> / <span data-token="text-${step}-line"></span
    ></span>
    <span class="tk-type-text tk-line" style="font-size: var(--text-${step}); line-height: var(--text-${step}-line)"
      >foundations/tokens · Pick variant</span
    >
  </div>`;

const spacingSample = html`<div class="tk-cluster tk-cluster--end">
  <span class="tk-height" style="height: var(--control-sm)">control-sm</span>
  <span class="tk-height" style="height: var(--control-md)">control-md</span>
  <span class="tk-height tk-height--row" style="height: var(--row)">row</span>
  <span class="tk-stack">
    <span class="tk-gap" style="gap: var(--space-1)"><i></i><i></i><i></i>space-1</span>
    <span class="tk-gap" style="gap: var(--space-3)"><i></i><i></i><i></i>space-3</span>
  </span>
</div>`;

const samples: Record<Group, string> = {
  surfaces: html`<div class="tk-grid">${surfaces.map(surfaceCard).join('')}</div>`,
  accent: html`<div class="tk-grid">${surfaces.map(accentCard).join('')}</div>`,
  type: html`<div class="tk-stack">${steps.map(typeSample).join('')}</div>`,
  spacing: spacingSample,
};

const fillValues = (root: HTMLElement) => {
  const style = getComputedStyle(root);
  const probe = root.querySelector<HTMLElement>('.tk-probe');

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

export default definePart<{ group: Group }>({
  note: 'The settled Studio tokens, one state per group: neutral grey surfaces, teal accent, compact type, balanced 4 px spacing. Each value is read from the CSS at runtime.',
  states: {
    surfaces: { group: 'surfaces' },
    accent: { group: 'accent' },
    type: { group: 'type' },
    spacing: { group: 'spacing' },
  },
  render: ({ group }) =>
    drawing({
      body: html`<div class="tk-root">
        <h2 class="tk-title">${groups[group].title}</h2>
        <section class="tk-panel">${samples[group]}</section>
        <ul class="tk-panel tk-list">
          ${namesOf(group).map(tokenRow).join('')}
        </ul>
        <span class="tk-probe"></span>
      </div>`,
      setup: fillValues,
      styles: `${tokens}
        html, body { margin: 0; background: var(--surface-sunken); }
        .tk-root { position: relative; display: flex; flex-direction: column; gap: var(--space-4); width: 960px; padding: var(--space-6); box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font-family: var(--font-ui); font-size: var(--text-md); line-height: var(--text-md-line); }
        .tk-title { margin: 0; font-size: var(--text-xl); line-height: var(--text-xl-line); font-weight: var(--weight-strong); }
        .tk-panel { margin: 0; padding: var(--space-4); background: var(--surface); border: 1px solid var(--surface-border); border-radius: var(--radius-control-lg); }
        .tk-list { list-style: none; display: flex; flex-direction: column; gap: var(--space-1); }
        .tk-row { display: grid; grid-template-columns: 200px 240px 1fr; align-items: center; gap: var(--space-3); min-height: var(--row); }
        .tk-name { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); color: var(--text-muted); }
        .tk-value { font-family: var(--font-code); font-size: var(--text-sm); line-height: var(--text-sm-line); overflow-wrap: anywhere; }
        .tk-sample { display: flex; align-items: center; min-width: 0; }
        .tk-swatch { width: 64px; height: var(--control-sm); border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); }
        .tk-shadow { width: 64px; height: var(--control-sm); background: var(--surface-overlay); border-radius: var(--radius-control-sm); box-shadow: 0 8px 24px var(--surface-shadow); }
        .tk-cluster { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        .tk-cluster--end { align-items: flex-end; gap: var(--space-5); }
        .tk-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }
        .tk-stack { display: flex; flex-direction: column; gap: var(--space-3); }
        .tk-surface { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--surface-border); border-radius: var(--radius-control-md); }
        .tk-surface-name { font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .tk-muted { color: var(--text-muted); }
        .tk-fill { display: inline-flex; align-items: center; height: var(--control-md); padding: 0 var(--space-3); border-radius: var(--radius-control-md); background: var(--accent); color: var(--on-accent); font-weight: var(--weight-medium); }
        .tk-fill--hover { background: var(--accent-hover); }
        .tk-ink { color: var(--accent-text); font-weight: var(--weight-medium); }
        .tk-subtle { align-self: stretch; display: flex; align-items: center; height: var(--row); padding: 0 var(--space-2); border-radius: var(--radius-control-sm); background: var(--accent-subtle); }
        .tk-ring { display: inline-flex; align-items: center; height: var(--control-md); padding: 0 var(--space-3); border: 1px solid var(--surface-border); border-radius: var(--radius-control-md); background: var(--surface-raised); outline: 2px solid var(--focus-ring); outline-offset: 2px; }
        .tk-type { display: grid; grid-template-columns: 120px 300px 1fr; align-items: center; gap: var(--space-3); }
        .tk-type-text { min-width: 0; }
        .tk-bar { display: block; height: var(--space-2); background: var(--accent); border-radius: 2px; }
        .tk-line { background: var(--accent-subtle); }
        .tk-radius { width: 40px; height: 40px; background: var(--surface-raised); border: 1px solid var(--accent); }
        .tk-height { display: inline-flex; align-items: center; padding: 0 var(--space-2); box-sizing: border-box; background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .tk-height--row { min-width: 200px; background: var(--accent-subtle); color: var(--text); }
        .tk-gap { display: flex; align-items: center; font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .tk-gap i { width: var(--space-4); height: var(--space-4); background: var(--accent); border-radius: 2px; }
        .tk-probe { position: absolute; left: 0; top: 0; height: 0; visibility: hidden; }
      `,
    }),
});
