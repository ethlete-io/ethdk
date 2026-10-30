import { definePart, drawing, html } from '@design-system';
import { tokenSheet, fillTokenValues, tokenSheetStyles } from '@shared/token-sheet';
import tokens from './colors.css?inline';

type Group = 'surfaces' | 'accent' | 'warning' | 'error';

const groups: Record<Group, { title: string; owns: (name: string) => boolean }> = {
  surfaces: { title: 'Surfaces and text', owns: (name) => /^surface(-|$)/.test(name) || /^text(-muted)?$/.test(name) },
  accent: { title: 'Accent', owns: (name) => /^(accent|on-accent|focus-ring)/.test(name) },
  warning: { title: 'Warning', owns: (name) => /^(on-)?warning/.test(name) },
  error: { title: 'Error', owns: (name) => /^(on-)?danger/.test(name) },
};

const namesOf = (group: Group) => [
  ...new Set([...tokens.matchAll(/^\s*--([\w-]+):/gm)].map(([, name]) => name ?? '').filter(groups[group].owns)),
];

const surfaces = ['surface', 'surface-raised', 'surface-overlay'];

const sampleOf = (name: string) => {
  if (name === 'surface-shadow') return html`<span class="co-shadow"></span>`;
  if (name === 'focus-ring') return html`<span class="co-ring">Focus</span>`;
  if (name === 'on-accent') return html`<span class="co-fill">Merge</span>`;
  if (name === 'on-warning') return html`<span class="co-fill co-fill--warning">Check again</span>`;
  if (name === 'on-danger') return html`<span class="co-fill co-fill--danger">Discard sketch</span>`;

  return html`<span class="co-swatch" style="background: var(--${name})"></span>`;
};

const surfaceCard = (surface: string) =>
  html`<div class="co-surface" style="background: var(--${surface})">
    <span class="co-surface-name">${surface}</span>
    <span>Text on ${surface}</span>
    <span class="co-muted">Muted on ${surface}</span>
  </div>`;

const accentCard = (surface: string) =>
  html`<div class="co-surface" style="background: var(--${surface})">
    <span class="co-surface-name">${surface}</span>
    <span class="co-cluster"><span class="co-fill">Merge</span><span class="co-fill co-fill--hover">Hover</span></span>
    <span class="co-ink">Accent text link</span>
    <span class="co-subtle">Selected row</span>
    <span class="co-ring">Focused</span>
  </div>`;

const mark = (paths: string) =>
  html`<svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    ${paths}
  </svg>`;

const marks = {
  ready: mark('<path d="m3.5 8.5 3 3 6-7"/>'),
  error: mark('<circle cx="8" cy="8" r="5.5"/><path d="m6 6 4 4m0-4-4 4"/>'),
  warning: mark('<path d="M8 2.5 14 13H2z"/><path d="M8 6.5v3"/><path d="M8 11.25v.01"/>'),
};

const markRow = (label: string, kind: keyof typeof marks) =>
  html`<span class="co-trow"
    ><span class="co-trow-label">${label}</span><span class="co-mark co-mark--${kind}">${marks[kind]}</span></span
  >`;

const markRows = html`<span class="co-trows">
  ${markRow('button', 'ready')}${markRow('select', 'warning')}${markRow('dialog', 'error')}
</span>`;

const warningCard = (surface: string) =>
  html`<div class="co-surface" style="background: var(--${surface})">
    <span class="co-surface-name">${surface}</span>
    ${markRows}
    <span class="co-warning-ink">Render check: 1 warning</span>
    <span class="co-warning-note"
      ><span class="co-mark co-mark--warning">${marks.warning}</span>The base product changed since this sketch
      started.</span
    >
  </div>`;

const errorCard = (surface: string) =>
  html`<div class="co-surface" style="background: var(--${surface})">
    <span class="co-surface-name">${surface}</span>
    ${markRows}
    <span class="co-danger-ink">Render check: 1 error</span>
    <span class="co-danger-note"
      ><span class="co-mark co-mark--error">${marks.error}</span>The dialog story threw while rendering.</span
    >
  </div>`;

const cards: Record<Group, (surface: string) => string> = {
  surfaces: surfaceCard,
  accent: accentCard,
  warning: warningCard,
  error: errorCard,
};

export default definePart<{ group: Group }>({
  note: 'The Studio surfaces, accent, warning and error colours. The source of the Studio SDK themes: `yarn studio:themes` generates them from this part.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra'],
  states: {
    surfaces: { group: 'surfaces' },
    accent: { group: 'accent' },
    warning: { group: 'warning' },
    error: { group: 'error' },
  },
  render: ({ group }) =>
    drawing({
      body: tokenSheet({
        title: groups[group].title,
        sample: surfaces.map(cards[group]).join(''),
        sampleClass: 'co-grid',
        names: namesOf(group),
        sampleOf,
      }),
      setup: (root) => fillTokenValues(root),
      styles: `${tokenSheetStyles}
        .co-swatch { width: 64px; height: var(--control-sm); border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); }
        .co-shadow { width: 64px; height: var(--control-sm); background: var(--surface-overlay); border-radius: var(--radius-control-sm); box-shadow: 0 8px 24px var(--surface-shadow); }
        .co-cluster { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        .co-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
        .co-surface { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--surface-border); border-radius: var(--radius-control-md); }
        .co-surface-name { font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .co-muted { color: var(--text-muted); }
        .co-fill { display: inline-flex; align-items: center; height: var(--control-md); padding: 0 var(--space-3); border-radius: var(--radius-control-md); background: var(--accent); color: var(--on-accent); font-weight: var(--weight-medium); }
        .co-fill--hover { background: var(--accent-hover); }
        .co-fill--warning { background: var(--warning); color: var(--on-warning); }
        .co-fill--danger { background: var(--danger); color: var(--on-danger); }
        .co-trows { align-self: stretch; display: flex; flex-direction: column; }
        .co-trow { display: flex; align-items: center; gap: var(--space-2); height: var(--row); padding: 0 var(--space-2); }
        .co-trow-label { flex: 1; }
        .co-mark { display: flex; flex: none; }
        .co-mark--ready { color: var(--accent); }
        .co-mark--error { color: var(--danger); }
        .co-mark--warning { color: var(--warning); }
        .co-warning-ink { color: var(--warning-text); font-weight: var(--weight-medium); }
        .co-warning-note { align-self: stretch; display: flex; align-items: center; gap: var(--space-2); min-height: var(--row); padding: var(--space-1) var(--space-2); border-radius: var(--radius-control-sm); background: var(--warning-subtle); }
        .co-danger-ink { color: var(--danger-text); font-weight: var(--weight-medium); }
        .co-danger-note { align-self: stretch; display: flex; align-items: center; gap: var(--space-2); min-height: var(--row); padding: var(--space-1) var(--space-2); border-radius: var(--radius-control-sm); background: var(--danger-subtle); }
        .co-ink { color: var(--accent-text); font-weight: var(--weight-medium); }
        .co-subtle { align-self: stretch; display: flex; align-items: center; height: var(--row); padding: 0 var(--space-2); border-radius: var(--radius-control-sm); background: var(--accent-subtle); }
        .co-ring { display: inline-flex; align-items: center; height: var(--control-md); padding: 0 var(--space-3); border: 1px solid var(--surface-border); border-radius: var(--radius-control-md); background: var(--surface-raised); outline: 2px solid var(--focus-ring); outline-offset: 2px; }
      `,
    }),
});
