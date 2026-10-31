import { contrastRatioOf, definePart, html, tokenSheet } from '@design-system';
import tokens from './colors.css?inline';

type Group = 'surfaces' | 'accent' | 'warning' | 'error';

const groups: Record<Group, { title: string; owns: (name: string) => boolean }> = {
  surfaces: {
    title: 'Surfaces and text',
    owns: (name) => /^surface(-|$)/.test(name) || /^text(-muted|-subtle)?$/.test(name),
  },
  accent: { title: 'Accent', owns: (name) => /^(accent|on-accent|focus-ring)/.test(name) },
  warning: { title: 'Warning', owns: (name) => /^(on-)?warning/.test(name) },
  error: { title: 'Error', owns: (name) => /^(on-)?danger/.test(name) },
};

const surfaces = ['surface', 'surface-dark-elevated', 'surface-dark-elevated-2'];

const surfaceTokens = surfaces.map((name) => `--${name}`);
const pairs = [
  {
    text: ['--text', '--text-muted', '--text-subtle', '--accent-text', '--warning-text', '--danger-text'],
    on: surfaceTokens,
  },
  { text: ['--on-accent'], on: ['--accent', '--accent-hover', '--accent-active'] },
  { text: ['--on-warning'], on: ['--warning', '--warning-hover', '--warning-active'] },
  { text: ['--on-danger'], on: ['--danger', '--danger-hover', '--danger-active'] },
];

const fillsOf = (kind: string) => [`--${kind}`, `--${kind}-hover`, `--${kind}-active`];

const ratiosOf = (name: string): { on: string[]; needs: number | null; ink: boolean } | null => {
  if (/^surface(-dark-elevated(-2)?|-shadow)?$/.test(name) || /^(accent|warning|danger)-subtle$/.test(name))
    return null;
  const onDisabled = /^on-(accent|warning|danger)-disabled$/.exec(name);
  if (onDisabled) return { on: [`--${onDisabled[1]}-disabled`], needs: null, ink: true };
  const onFill = /^on-(accent|warning|danger)$/.exec(name);
  if (onFill) return { on: fillsOf(onFill[1] ?? ''), needs: 4.5, ink: true };
  if (name === 'surface-border' || name.endsWith('-disabled')) return { on: surfaceTokens, needs: null, ink: false };
  const ink = /^text(-|$)/.test(name) || name.endsWith('-text');
  return { on: surfaceTokens, needs: ink ? 4.5 : 3, ink };
};

const ratioChips = (name: string) => {
  const ratios = ratiosOf(name);
  if (!ratios) return '';
  const { on, needs, ink } = ratios;
  return html`<span class="co-ratios"
    ><span class="co-needs">${needs === null ? 'exempt' : `≥ ${needs}`}</span>${on
      .map(
        (surface) =>
          html`<span
            class="co-ratio"
            style="background: var(${surface})${ink ? `; color: var(--${name})` : ''}"
            title="--${name} on ${surface}"
            data-co-ratio="--${name} ${surface}"
            data-co-needs="${needs ?? ''}"
            ${needs === null ? 'aria-disabled="true"' : ''}
            >${ink ? '' : html`<span class="co-dot" style="background: var(--${name})"></span>`}<span
              class="co-ratio-value"
            ></span
          ></span>`,
      )
      .join('')}</span
  >`;
};

const fillRatios = (root: HTMLElement) => {
  for (const chip of root.querySelectorAll<HTMLElement>('[data-co-ratio]')) {
    const [text = '', on = ''] = (chip.dataset['coRatio'] ?? '').split(' ');
    const ratio = contrastRatioOf({ text: `var(${text})`, on: `var(${on})`, within: root });
    const needs = Number(chip.dataset['coNeeds']);
    const value = chip.querySelector('.co-ratio-value');
    if (value) value.textContent = ratio.toFixed(1);
    if (needs && ratio < needs) {
      chip.classList.add('co-ratio--low');
      chip.insertAdjacentHTML('beforeend', `<span class="co-low">${marks.error}</span>`);
    }
  }
};

const swatchOf = (name: string) => {
  if (name === 'surface-shadow') return html`<span class="co-shadow"></span>`;
  if (name === 'focus-ring') return html`<span class="co-ring">Focus</span>`;
  const stateFill = /^on-(accent|warning|danger)-disabled$/.exec(name);
  if (stateFill)
    return html`<span class="co-fill co-fill--${stateFill[1]} co-fill--disabled" aria-disabled="true">Disabled</span>`;
  if (name === 'text-subtle') return html`<span class="co-subtle-text">Subtle text</span>`;
  if (/^(accent|warning|danger)-active$/.test(name))
    return html`<span class="co-swatch" style="background: var(--${name})"></span>`;
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
    <span class="co-subtle-text">Subtle on ${surface}</span>
  </div>`;

const accentCard = (surface: string) =>
  html`<div class="co-surface" style="background: var(--${surface})">
    <span class="co-surface-name">${surface}</span>
    <span class="co-cluster"
      ><span class="co-fill">Merge</span><span class="co-fill co-fill--hover">Hover</span
      ><span class="co-fill co-fill--active">Active</span
      ><span class="co-fill co-fill--disabled" aria-disabled="true">Disabled</span></span
    >
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
    <span class="co-cluster"
      ><span class="co-fill co-fill--warning">Check again</span
      ><span class="co-fill co-fill--warning co-fill--active">Active</span
      ><span class="co-fill co-fill--warning co-fill--disabled" aria-disabled="true">Disabled</span></span
    >
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
    <span class="co-cluster"
      ><span class="co-fill co-fill--danger">Discard sketch</span
      ><span class="co-fill co-fill--danger co-fill--active">Active</span
      ><span class="co-fill co-fill--danger co-fill--disabled" aria-disabled="true">Disabled</span></span
    >
    <span class="co-danger-ink">Render check: 1 error</span>
    <span class="co-danger-note"
      ><span class="co-mark co-mark--error">${marks.error}</span>The dialog story threw while rendering.</span
    >
  </div>`;

const sampleOf = (name: string) => `${swatchOf(name)}${ratioChips(name)}`;

const cards: Record<Group, (surface: string) => string> = {
  surfaces: surfaceCard,
  accent: accentCard,
  warning: warningCard,
  error: errorCard,
};

export default definePart<{ group: Group }>({
  note: 'The Studio surfaces, accent, warning and error colours. The source of the Studio SDK themes: `yarn studio:themes` generates them from this part.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5'],
  contrast: { pairs },
  states: {
    surfaces: { group: 'surfaces' },
    accent: { group: 'accent' },
    warning: { group: 'warning' },
    error: { group: 'error' },
  },
  render: ({ group }) =>
    tokenSheet({
      title: groups[group].title,
      css: tokens,
      sample: surfaces.map(cards[group]).join(''),
      sampleClass: 'co-grid',
      only: groups[group].owns,
      sampleOf,
      setup: fillRatios,
      styles: `
        .co-ratios { display: flex; align-items: center; gap: var(--space-1); width: 248px; margin-left: auto; }
        .co-needs { width: 48px; font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .co-ratio { display: inline-flex; align-items: center; justify-content: flex-end; gap: var(--space-1); width: 64px; height: var(--control-sm); padding: 0 var(--space-2); box-sizing: border-box; border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); font-family: var(--font-code); font-size: var(--text-xs); font-variant-numeric: tabular-nums; }
        .co-ratio--low { border-color: var(--danger); }
        .co-dot { width: 8px; height: 8px; margin-right: auto; border-radius: 50%; }
        .co-low { display: flex; color: var(--danger-text); }
        .co-swatch { width: 64px; height: var(--control-sm); border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); }
        .co-shadow { width: 64px; height: var(--control-sm); background: var(--color-et-surface-dark-elevated-2-bg); border-radius: var(--radius-control-sm); box-shadow: 0 8px 24px var(--surface-shadow); }
        .co-cluster { display: flex; flex-wrap: wrap; gap: var(--space-3); }
        .co-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }
        .co-surface { display: flex; flex-direction: column; align-items: flex-start; gap: var(--space-2); padding: var(--space-4); border: 1px solid var(--surface-border); border-radius: var(--radius-control-md); }
        .co-surface-name { font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .co-muted { color: var(--text-muted); }
        .co-fill { display: inline-flex; align-items: center; height: var(--control-md); padding: 0 var(--space-3); border-radius: var(--radius-control-md); background: var(--accent); color: var(--on-accent); font-weight: var(--weight-medium); }
        .co-fill--hover { background: var(--accent-hover); }
        .co-fill--warning { background: var(--warning); color: var(--on-warning); }
        .co-fill--danger { background: var(--danger); color: var(--on-danger); }
        .co-fill--active { background: var(--accent-active); }
        .co-fill--warning.co-fill--active { background: var(--warning-active); }
        .co-fill--danger.co-fill--active { background: var(--danger-active); }
        .co-fill--disabled { background: var(--accent-disabled); color: var(--on-accent-disabled); }
        .co-fill--warning.co-fill--disabled { background: var(--warning-disabled); color: var(--on-warning-disabled); }
        .co-fill--danger.co-fill--disabled { background: var(--danger-disabled); color: var(--on-danger-disabled); }
        .co-subtle-text { color: var(--text-subtle); }
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
        .co-ring { display: inline-flex; align-items: center; height: var(--control-md); padding: 0 var(--space-3); border: 1px solid var(--surface-border); border-radius: var(--radius-control-md); background: var(--color-et-surface-dark-elevated-bg); outline: 2px solid var(--focus-ring); outline-offset: 2px; }
      `,
    }),
});
