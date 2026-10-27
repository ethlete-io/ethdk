import { definePart, drawing, html } from '@design-system';
import tokens from './tokens.css?inline';

const variant = {
  title: 'B · balanced, 4 px grid, radius 6',
  cost: 'Pure 4 px steps. 28 px controls are comfortable targets; about 10 % fewer tree rows than A. Radius 6 / 10 reads softer, a little less tool-like.',
};

const space = { xxs: 1, xs: 2, sm: 3, md: 4, lg: 6, xl: 7 };

const pxOf = (css: string, name: string) => {
  const rem = new RegExp(`--${name}:\\s*([\\d.]+)(rem|px)?;`).exec(css);

  if (!rem) return 0;

  return rem[2] === 'px' ? Number(rem[1]) : Math.round(Number(rem[1]) * 100) / 10;
};

const tokenNames = (css: string) => [
  ...[...css.matchAll(/--(space-\d+):/g)].map(([, name]) => name ?? ''),
  'radius-sm',
  'radius-md',
  'radius-lg',
  'radius-full',
  'control-sm',
  'control-md',
  'row',
];

const tokenItem = (name: string) =>
  html`<li class="st-token"><span class="st-token-name">--${name}</span><span>${pxOf(tokens, name)}</span></li>`;

const costs = [
  ['Tree rows per 800 px', Math.floor(800 / pxOf(tokens, 'row'))],
  ['Toolbar height', pxOf(tokens, 'control-md') + 2 * pxOf(tokens, `space-${space.xs}`)],
  ['Card padding', pxOf(tokens, `space-${space.md}`)],
  ['Canvas gap', pxOf(tokens, `space-${space.xl}`)],
];

const gap = (role: keyof typeof space) => `var(--space-${space[role]})`;

const type = (role: string) => `font-size: var(--text-${role}); line-height: var(--text-${role}-line);`;

const icon = (path: string) =>
  html`<svg class="st-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="${path}" />
  </svg>`;

const icons = {
  plus: 'M8 3v10M3 8h10',
  comment: 'M3 4h10v7H7l-3 2v-2H3z',
  check: 'M3.5 8.5l3 3 6-7',
  chevron: 'M6 4l4 4-4 4',
  dot: 'M7 8h2',
};

const treeGroup = (label: string, rows: string[], marks: Record<string, string> = {}) =>
  html`<div class="st-group">${label}</div>
    ${rows
      .map(
        (row) =>
          html`<div class="st-row${marks[row] ? ` st-row--${marks[row]}` : ''}">
            ${icon(icons.dot)}<span>${row}</span>
          </div>`,
      )
      .join('')}`;

const menuItem = (label: string, hint: string, selected = false) =>
  html`<div class="st-menu-item${selected ? ' st-menu-item--selected' : ''}">
    <span class="st-menu-check">${selected ? icon(icons.check) : ''}</span><span class="st-menu-label">${label}</span
    ><span class="st-menu-hint">${hint}</span>
  </div>`;

const comment = (initial: string, author: string, time: string, text: string) =>
  html`<div class="st-comment">
    <span class="st-avatar">${initial}</span>
    <div class="st-comment-main">
      <div class="st-comment-head"><span class="st-author">${author}</span><span class="st-time">${time}</span></div>
      <p class="st-comment-text">${text}</p>
    </div>
  </div>`;

const scene = html`<div class="st-scene">
  <header class="st-toolbar">
    <span class="st-toolbar-title">foundations/tokens</span>
    <span class="st-btn">${icon(icons.plus)}New sketch</span>
    <span class="st-btn">${icon(icons.comment)}Comment</span>
    <span class="st-segmented">
      <span class="st-segment">Phone</span><span class="st-segment">Tablet</span
      ><span class="st-segment st-segment--on">Desktop</span>
    </span>
    <span class="st-toolbar-spacer"></span>
    <span class="st-btn st-btn--primary">Pick variant</span>
  </header>
  <div class="st-body">
    <aside class="st-sidebar">
      ${treeGroup('Foundations', ['tokens'], { tokens: 'selected' })}
      ${treeGroup('Components', ['button', 'form-field', 'select'], { 'form-field': 'focus' })}
      ${treeGroup('Elements', ['shell-main'])} ${treeGroup('Pages', ['library', 'film-detail', 'settings'])}
    </aside>
    <main class="st-canvas">
      <div class="st-frame-slot">
        <div class="st-frame">
          <span class="st-chip">desktop 1440 · rest</span>
          <div class="st-frame-body"><span class="st-btn st-btn--primary">Save</span></div>
        </div>
      </div>
      <div class="st-menu">
        ${menuItem('Open in canvas', 'O')} ${menuItem('Compare variants', 'C', true)} ${menuItem('Copy link', 'L')}
        <div class="st-menu-sep"></div>
        ${menuItem('Discard sketch', '')}
      </div>
      <article class="st-card">
        <h3 class="st-card-title">Spacing tokens</h3>
        <p class="st-card-text">One grid for gaps, paddings and control heights. Rows and buttons derive from it.</p>
        <div class="st-actions">
          <span class="st-btn st-btn--primary">Merge</span><span class="st-btn st-btn--focus">Discard</span>
        </div>
      </article>
      <section class="st-thread">
        ${comment('T', 'Tom', '2 h ago', 'The tree feels tight next to the toolbar. Does the row height follow the grid?')}
        ${comment('C', 'claude-opus-5-5', '1 h ago', 'Yes: the row is the md line height plus a step on each side.')}
        <span class="st-reply">Reply…</span>
      </section>
    </main>
  </div>
</div>`;

export default definePart<{ theme: 'dark' }>({
  note: 'b',
  states: { dark: { theme: 'dark' } },
  render: () =>
    drawing({
      body: html`<div class="st-root">
        <div class="st-side">
          <div class="st-panel">
            <div class="st-variant-title">${variant.title}</div>
            <div class="st-variant-cost">${variant.cost}</div>
          </div>
          <ul class="st-panel st-tokens">
            ${tokenNames(tokens).map(tokenItem).join('')}
          </ul>
          <ul class="st-panel st-tokens">
            ${costs
              .map(([label, value]) => html`<li class="st-token"><span>${label}</span><span>${value}</span></li>`)
              .join('')}
          </ul>
        </div>
        ${scene}
      </div>`,
      styles: `${tokens}
        .st-root { display: flex; gap: 24px; padding: 24px; width: 1280px; box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font-family: var(--font-sans); ${type('md')} }
        .st-side { width: 264px; flex: none; display: flex; flex-direction: column; gap: 12px; }
        .st-panel { margin: 0; padding: 12px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: 8px; }
        .st-variant-title { font-weight: var(--weight-strong); ${type('lg')} }
        .st-variant-cost { margin-top: 4px; color: var(--text-muted); ${type('sm')} }
        .st-tokens { list-style: none; display: flex; flex-direction: column; gap: 2px; ${type('sm')} }
        .st-token { display: flex; justify-content: space-between; gap: 8px; }
        .st-token-name { font-family: var(--font-mono); color: var(--text-muted); }
        .st-icon { width: 14px; height: 14px; flex: none; }
        .st-scene { flex: 1; min-width: 0; display: flex; flex-direction: column; border: 1px solid var(--surface-border); border-radius: var(--radius-lg); }
        .st-toolbar { display: flex; align-items: center; gap: ${gap('xs')}; padding: ${gap('xs')} ${gap('sm')}; background: var(--surface); border-bottom: 1px solid var(--surface-border); border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
        .st-toolbar-title { margin-right: ${gap('xs')}; font-weight: var(--weight-strong); }
        .st-toolbar-spacer { flex: 1; }
        .st-btn { display: inline-flex; align-items: center; gap: ${gap('xxs')}; height: var(--control-md); padding: 0 ${gap('sm')}; box-sizing: border-box; border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-raised); font-weight: var(--weight-medium); white-space: nowrap; }
        .st-btn--primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
        .st-btn--focus { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
        .st-segmented { display: inline-flex; height: var(--control-md); padding: 2px; box-sizing: border-box; border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-sunken); }
        .st-segment { display: inline-flex; align-items: center; padding: 0 ${gap('sm')}; border-radius: var(--radius-sm); color: var(--text-muted); font-weight: var(--weight-medium); }
        .st-segment--on { background: var(--surface-overlay); color: var(--text); }
        .st-body { flex: 1; display: flex; }
        .st-sidebar { width: 196px; flex: none; padding: ${gap('xs')}; box-sizing: border-box; background: var(--surface); border-right: 1px solid var(--surface-border); border-radius: 0 0 0 var(--radius-lg); }
        .st-group { padding: ${gap('md')} ${gap('xs')} ${gap('xxs')}; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: var(--weight-medium); ${type('xs')} }
        .st-group:first-child { padding-top: ${gap('xxs')}; }
        .st-row { display: flex; align-items: center; gap: ${gap('xxs')}; height: var(--row); padding: 0 ${gap('xs')}; border-radius: var(--radius-sm); color: var(--text-muted); }
        .st-row--selected { background: var(--accent-subtle); color: var(--text); font-weight: var(--weight-medium); }
        .st-row--focus { outline: 2px solid var(--focus-ring); outline-offset: -2px; color: var(--text); }
        .st-canvas { flex: 1; min-width: 0; display: grid; grid-template-columns: 1fr 1fr; align-items: start; align-content: start; gap: ${gap('xl')}; padding: ${gap('xl')}; background: var(--surface-sunken); border-radius: 0 0 var(--radius-lg) 0; }
        .st-frame-slot { padding-top: var(--text-xs-line); }
        .st-frame { position: relative; height: 120px; background: var(--surface); box-shadow: 0 0 0 2px var(--accent); }
        .st-chip { position: absolute; left: -2px; bottom: 100%; margin-bottom: 2px; padding: 0 ${gap('xxs')}; border-radius: var(--radius-sm) var(--radius-sm) 0 0; background: var(--accent); color: var(--on-accent); font-weight: var(--weight-medium); white-space: nowrap; ${type('xs')} }
        .st-frame-body { height: 100%; display: grid; place-items: center; }
        .st-menu { padding: ${gap('xxs')}; background: var(--surface-overlay); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); box-shadow: 0 8px 24px var(--surface-shadow); }
        .st-menu-item { display: flex; align-items: center; gap: ${gap('xs')}; height: var(--control-md); padding: 0 ${gap('xs')}; border-radius: var(--radius-sm); }
        .st-menu-item--selected { background: var(--accent-subtle); }
        .st-menu-check { display: inline-flex; width: 14px; color: var(--accent-text); }
        .st-menu-label { flex: 1; }
        .st-menu-hint { color: var(--text-muted); font-family: var(--font-mono); ${type('sm')} }
        .st-menu-sep { height: 1px; margin: ${gap('xxs')} 0; background: var(--surface-border); }
        .st-card { padding: ${gap('md')}; background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); }
        .st-card-title { margin: 0 0 ${gap('xxs')}; font-weight: var(--weight-strong); ${type('xl')} }
        .st-card-text { margin: 0 0 ${gap('md')}; color: var(--text-muted); }
        .st-actions { display: flex; gap: ${gap('xs')}; }
        .st-thread { display: flex; flex-direction: column; gap: ${gap('sm')}; padding: ${gap('md')}; background: var(--surface-overlay); border: 1px solid var(--surface-border); border-radius: var(--radius-lg); box-shadow: 0 8px 24px var(--surface-shadow); }
        .st-comment { display: flex; gap: ${gap('xs')}; }
        .st-avatar { display: inline-grid; place-items: center; width: var(--control-sm); height: var(--control-sm); flex: none; border-radius: var(--radius-full); background: var(--accent-subtle); color: var(--accent-text); font-weight: var(--weight-strong); ${type('xs')} }
        .st-comment-main { min-width: 0; }
        .st-comment-head { display: flex; align-items: baseline; gap: ${gap('xs')}; }
        .st-author { font-weight: var(--weight-strong); }
        .st-time { color: var(--text-muted); ${type('xs')} }
        .st-comment-text { margin: 0; }
        .st-reply { display: flex; align-items: center; height: var(--control-md); padding: 0 ${gap('xs')}; border: 1px solid var(--surface-border); border-radius: var(--radius-md); background: var(--surface-sunken); color: var(--text-muted); }
      `,
    }),
});
