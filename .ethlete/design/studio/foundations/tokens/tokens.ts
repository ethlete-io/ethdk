import { definePart, drawing, html } from '@design-system';
import tokens from './tokens.css?inline';

const variant = {
  title: 'B · compact, 13 px base, ratio 1.15',
  cost: 'One pixel above A: still dense, easier to read at length. Fractional 11.5 px sm renders slightly soft on a 1x screen.',
};

const roles = { label: 'xs', mono: 'sm', heading: 'xl', title: 'lg' };

const scaleOf = (css: string) => {
  const value = (name: string) =>
    Math.round(Number(new RegExp(`--${name}:\\s*([\\d.]+)rem;`).exec(css)?.[1] ?? 0) * 100) / 10;

  return [...css.matchAll(/--text-(xs|sm|md|lg|xl):/g)].map(([, step]) => ({
    step: step ?? '',
    size: value(`text-${step}`),
    line: value(`text-${step}-line`),
  }));
};

const scaleItem = ({ step, size, line }: { step: string; size: number; line: number }) =>
  html`<li class="st-scale-row">
    <span class="st-scale-name">--text-${step}</span>
    <span class="st-scale-px">${size} / ${line}</span>
    <span class="st-scale-sample" style="font-size: var(--text-${step}); line-height: var(--text-${step}-line)"
      >Frames and variants</span
    >
  </li>`;

const type = (role: string) => `font-size: var(--text-${role}); line-height: var(--text-${role}-line);`;

const treeGroup = (label: string, rows: string[], selected = '') =>
  html`<div class="st-group">${label}</div>
    ${rows
      .map((row) => html`<div class="st-row${row === selected ? ' st-row--selected' : ''}">${row}</div>`)
      .join('')}`;

const scene = html`<div class="st-scene">
  <header class="st-toolbar">
    <span class="st-toolbar-title">foundations/tokens</span>
    <span class="st-toolbar-meta">sketch · round 1</span>
    <span class="st-toolbar-spacer"></span>
    <span class="st-btn">Comment</span>
    <span class="st-btn">Compare</span>
    <span class="st-btn st-btn--primary">Pick variant</span>
  </header>
  <div class="st-body">
    <aside class="st-sidebar">
      ${treeGroup('Foundations', ['tokens'], 'tokens')} ${treeGroup('Components', ['button', 'form-field', 'select'])}
      ${treeGroup('Pages', ['library', 'film-detail'])}
    </aside>
    <main class="st-canvas">
      <div class="st-frame">
        <span class="st-chip">phone 390 · rest</span>
        <div class="st-frame-body"><span class="st-btn st-btn--primary">Save</span></div>
      </div>
      <div class="st-canvas-row">
        <article class="st-card">
          <h3 class="st-card-title">Surface tokens</h3>
          <p class="st-card-text">
            Five neutral greys, from the sunken canvas up to the overlay. Text holds its contrast on each.
          </p>
          <div class="st-value"><span>--surface</span><span>oklch(0.205 0 0)</span></div>
          <p class="st-caption">Merged 27 Oct · variant A</p>
        </article>
        <section class="st-thread">
          <div class="st-comment">
            <div class="st-comment-head"><span class="st-author">Tom</span><span class="st-time">2 h ago</span></div>
            <p class="st-comment-text">The group labels feel tight. Can the tree breathe a little more?</p>
          </div>
          <div class="st-comment">
            <div class="st-comment-head">
              <span class="st-author">claude-opus-5-5</span><span class="st-time">1 h ago</span>
            </div>
            <p class="st-comment-text">Drew a round with more row height.</p>
            <span class="st-id">20261027T101641Z-1613</span>
          </div>
        </section>
      </div>
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
          <div class="st-variant">
            <div class="st-variant-title">${variant.title}</div>
            <div class="st-variant-cost">${variant.cost}</div>
          </div>
          <ul class="st-scale">
            ${scaleOf(tokens).map(scaleItem).join('')}
          </ul>
          <div class="st-weights">
            <span style="font-weight: var(--weight-regular)">Regular 400</span>
            <span style="font-weight: var(--weight-medium)">Medium 500</span>
            <span style="font-weight: var(--weight-strong)">Strong 600</span>
          </div>
        </div>
        ${scene}
      </div>`,
      styles: `${tokens}
        .st-root { display: flex; gap: 24px; padding: 24px; width: 1200px; box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font-family: var(--font-sans); ${type('md')} }
        .st-side { width: 300px; flex: none; display: flex; flex-direction: column; gap: 12px; }
        .st-variant, .st-scale, .st-weights { padding: 12px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: 8px; }
        .st-variant-title { font-weight: var(--weight-strong); ${type('lg')} }
        .st-variant-cost { margin-top: 4px; color: var(--text-muted); ${type('sm')} }
        .st-scale { list-style: none; margin: 0; display: flex; flex-direction: column; gap: 8px; }
        .st-scale-row { display: grid; grid-template-columns: 76px 1fr; column-gap: 8px; align-items: baseline; }
        .st-scale-name { font-family: var(--font-mono); ${type(roles.mono)} }
        .st-scale-px { color: var(--text-muted); font-family: var(--font-mono); ${type(roles.mono)} }
        .st-scale-sample { grid-column: 1 / -1; white-space: nowrap; }
        .st-weights { display: flex; justify-content: space-between; }
        .st-scene { flex: 1; min-width: 0; display: flex; flex-direction: column; border: 1px solid var(--surface-border); border-radius: 8px; overflow: hidden; }
        .st-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--surface); border-bottom: 1px solid var(--surface-border); }
        .st-toolbar-title { font-weight: var(--weight-strong); ${type(roles.title)} }
        .st-toolbar-meta { color: var(--text-muted); ${type(roles.label)} }
        .st-toolbar-spacer { flex: 1; }
        .st-btn { display: inline-block; padding: 4px 10px; border: 1px solid var(--surface-border); border-radius: 6px; font-weight: var(--weight-medium); white-space: nowrap; ${type('md')} }
        .st-btn--primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
        .st-body { display: flex; }
        .st-sidebar { width: 180px; flex: none; padding: 8px; background: var(--surface); border-right: 1px solid var(--surface-border); }
        .st-group { padding: 10px 8px 4px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: var(--weight-medium); ${type(roles.label)} }
        .st-group:first-child { padding-top: 2px; }
        .st-row { position: relative; padding: 3px 8px 3px 20px; border-radius: 6px; }
        .st-row--selected { background: var(--accent-subtle); font-weight: var(--weight-medium); }
        .st-row--selected::before { content: ''; position: absolute; left: 8px; top: 5px; bottom: 5px; width: 3px; border-radius: 2px; background: var(--accent); }
        .st-canvas { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 24px; padding: 40px 24px 24px; background: var(--surface-sunken); }
        .st-frame { position: relative; width: 260px; height: 96px; background: var(--surface); border-radius: 4px; box-shadow: 0 0 0 2px var(--accent); }
        .st-chip { position: absolute; left: -2px; bottom: 100%; margin-bottom: 2px; padding: 1px 8px; border-radius: 4px 4px 0 0; background: var(--accent); color: var(--on-accent); font-weight: var(--weight-medium); white-space: nowrap; ${type(roles.label)} }
        .st-frame-body { height: 100%; display: grid; place-items: center; }
        .st-canvas-row { display: flex; gap: 20px; align-items: flex-start; }
        .st-card { width: 280px; flex: none; padding: 16px; box-sizing: border-box; background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: 10px; }
        .st-card-title { margin: 0 0 6px; font-weight: var(--weight-strong); ${type(roles.heading)} }
        .st-card-text { margin: 0 0 12px; }
        .st-value { display: flex; justify-content: space-between; gap: 8px; padding: 6px 8px; border-radius: 6px; background: var(--surface); font-family: var(--font-mono); ${type(roles.mono)} }
        .st-caption { margin: 10px 0 0; color: var(--text-muted); ${type(roles.label)} }
        .st-thread { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; padding: 12px; background: var(--surface-overlay); border: 1px solid var(--surface-border); border-radius: 8px; box-shadow: 0 8px 24px var(--surface-shadow); }
        .st-comment + .st-comment { padding-top: 12px; border-top: 1px solid var(--surface-border); }
        .st-comment-head { display: flex; align-items: baseline; gap: 8px; }
        .st-author { font-weight: var(--weight-strong); }
        .st-time { color: var(--text-muted); ${type(roles.label)} }
        .st-comment-text { margin: 2px 0 0; }
        .st-id { display: inline-block; margin-top: 6px; color: var(--accent-text); font-family: var(--font-mono); ${type(roles.mono)} }
      `,
    }),
});
