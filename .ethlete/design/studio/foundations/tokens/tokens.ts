import { definePart, drawing, html } from '@design-system';
import tokens from './tokens.css?inline';

const variant = {
  title: 'C · teal, hue 190',
  cost: 'Calm and distinct; sRGB caps teal chroma at 0.11, so the fill is the dullest.',
};

const ownTokensOf = (css: string) =>
  [...css.matchAll(/(?<![\w-])--((?:surface|text|accent|on-accent|focus)[\w-]*):\s*([^;]+);/g)].map(
    ([, name, value]) => ({ name: name ?? '', value: (value ?? '').trim() }),
  );

const tokenItem = ({ name, value }: { name: string; value: string }) =>
  html`<li class="st-token">
    <span class="st-chip" style="background: var(--${name})"></span>
    <span class="st-token-name">${name}</span>
    <span class="st-token-value">${value}</span>
  </li>`;

const allTokens = ownTokensOf(tokens);
const accentTokens = allTokens.filter(({ name }) => !/^(surface|text)/.test(name));
const surfaceTokens = allTokens.filter(({ name }) => /^(surface|text)/.test(name));

const scene = html`<div class="st-scene">
  <aside class="st-sidebar">
    <div class="st-nav-title">Library</div>
    <div class="st-tree-row">▾ Foundations</div>
    <div class="st-tree-row st-tree-row--child st-tree-row--selected">tokens</div>
    <div class="st-tree-row">▾ Components</div>
    <div class="st-tree-row st-tree-row--child">button</div>
    <div class="st-tree-row st-tree-row--child">select</div>
    <div class="st-tree-row">▸ Pages</div>
    <span class="st-tag">tree row selected</span>
  </aside>
  <main class="st-canvas">
    <div class="st-frame">
      <span class="st-frame-label">button · solid</span>
      <div class="st-frame-body">
        <span class="st-btn st-btn--outline st-btn--focus">Focused</span>
      </div>
    </div>
    <span class="st-tag st-tag--frame">frame selected · element focused</span>

    <article class="st-card">
      <h3 class="st-card-title">Button</h3>
      <p class="st-card-text">Solid, outline and text. <a class="st-link">Open in canvas</a></p>
      <div class="st-btn-row">
        <span class="st-btn-demo"
          ><span class="st-btn st-btn--primary">Save</span><span class="st-tag-inline">rest</span></span
        >
        <span class="st-btn-demo"
          ><span class="st-btn st-btn--primary st-btn--hover">Save</span><span class="st-tag-inline">hover</span></span
        >
      </div>
      <div class="st-checks">
        <span class="st-check-row"><span class="st-check st-check--on">✓</span>Phone</span>
        <span class="st-check-row"><span class="st-check st-check--on">–</span>Presets (mixed)</span>
        <span class="st-check-row"><span class="st-check"></span>Desktop</span>
      </div>
    </article>

    <div class="st-popover">
      <div class="st-menu-item">Rename</div>
      <div class="st-menu-item st-menu-item--selected"><span>Variant A</span><span class="st-menu-mark">✓</span></div>
      <div class="st-menu-item">Variant B</div>
      <div class="st-menu-item st-menu-item--muted">Move to…</div>
    </div>
  </main>
</div>`;

export default definePart<{ theme: 'dark' }>({
  note: 'approved',
  madeBy: ['claude-opus-5-5'],
  states: { dark: { theme: 'dark' } },
  render: () =>
    drawing({
      body: html`<div class="st-root">
        <div class="st-side">
          <div class="st-variant">
            <div class="st-variant-title">${variant.title}</div>
            <div class="st-variant-cost">${variant.cost}</div>
          </div>
          <ul class="st-tokens">
            ${accentTokens.map(tokenItem).join('')}
          </ul>
          <ul class="st-tokens st-tokens--quiet">
            ${surfaceTokens.map(tokenItem).join('')}
          </ul>
        </div>
        ${scene}
      </div>`,
      styles: `${tokens}
        .st-root { display: flex; gap: 24px; padding: 24px; width: 1200px; box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font: 13px/1.4 system-ui, sans-serif; }
        .st-side { width: 300px; flex: none; display: flex; flex-direction: column; gap: 12px; }
        .st-variant { padding: 12px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: 8px; }
        .st-variant-title { font-size: 15px; font-weight: 600; }
        .st-variant-cost { margin-top: 4px; color: var(--text-muted); font-size: 12px; }
        .st-tokens { list-style: none; margin: 0; padding: 12px; display: flex; flex-direction: column; gap: 6px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: 8px; }
        .st-tokens--quiet { gap: 2px; padding: 8px 12px; }
        .st-tokens--quiet .st-token-name, .st-tokens--quiet .st-token-value { font-size: 11px; font-weight: 400; color: var(--text-muted); }
        .st-tokens--quiet .st-chip { width: 12px; height: 12px; grid-row: auto; }
        .st-tokens--quiet .st-token { grid-template-columns: 12px 120px 1fr; }
        .st-token { display: grid; grid-template-columns: 20px 1fr; column-gap: 8px; align-items: center; }
        .st-chip { grid-row: span 2; width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--surface-border); }
        .st-token-name { font-weight: 600; }
        .st-token-value { color: var(--text-muted); font: 11px/1.3 ui-monospace, monospace; }
        .st-scene { position: relative; flex: 1; display: flex; height: 470px; border: 1px solid var(--surface-border); border-radius: 8px; overflow: hidden; }
        .st-tag { position: absolute; color: var(--text-muted); font: 10px/1 ui-monospace, monospace; }
        .st-sidebar { position: relative; width: 176px; flex: none; padding: 12px 8px; background: var(--surface); border-right: 1px solid var(--surface-border); }
        .st-sidebar .st-tag { left: 16px; bottom: 12px; }
        .st-nav-title { padding: 4px 8px 8px; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
        .st-tree-row { position: relative; padding: 5px 8px; border-radius: 6px; }
        .st-tree-row--child { padding-left: 24px; }
        .st-tree-row--selected { background: var(--accent-subtle); }
        .st-tree-row--selected::before { content: ''; position: absolute; left: 10px; top: 6px; bottom: 6px; width: 3px; border-radius: 2px; background: var(--accent); }
        .st-canvas { position: relative; flex: 1; background: var(--surface-sunken); }
        .st-frame { position: absolute; left: 32px; top: 44px; width: 220px; height: 120px; background: var(--surface); border-radius: 4px; box-shadow: 0 0 0 2px var(--accent); }
        .st-frame-label { position: absolute; left: -2px; top: -24px; padding: 2px 8px; border-radius: 4px 4px 0 0; background: var(--accent); color: var(--on-accent); font: 600 11px/18px system-ui, sans-serif; }
        .st-frame-body { height: 100%; display: grid; place-items: center; }
        .st-tag--frame { left: 32px; top: 176px; }
        .st-btn { display: inline-block; padding: 7px 14px; border-radius: 6px; font-weight: 600; line-height: 18px; }
        .st-btn--outline { border: 1px solid var(--surface-border); color: var(--text); padding: 6px 13px; }
        .st-btn--focus { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
        .st-btn--primary { background: var(--accent); color: var(--on-accent); }
        .st-btn--hover { background: var(--accent-hover); }
        .st-card { position: absolute; left: 32px; top: 208px; width: 300px; padding: 16px; box-sizing: border-box; background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: 10px; }
        .st-card-title { margin: 0 0 4px; font-size: 15px; }
        .st-card-text { margin: 0 0 14px; color: var(--text-muted); }
        .st-link { color: var(--accent-text); text-decoration: underline; text-underline-offset: 2px; }
        .st-btn-row { display: flex; gap: 16px; }
        .st-btn-demo { display: inline-flex; flex-direction: column; align-items: center; gap: 4px; }
        .st-tag-inline { color: var(--text-muted); font: 10px/1 ui-monospace, monospace; }
        .st-checks { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
        .st-check-row { display: flex; align-items: center; gap: 8px; }
        .st-check { width: 16px; height: 16px; box-sizing: border-box; display: grid; place-items: center; border-radius: 4px; border: 1px solid var(--surface-border); font: 700 12px/1 system-ui, sans-serif; }
        .st-check--on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
        .st-popover { position: absolute; left: 372px; top: 236px; width: 190px; padding: 6px; background: var(--surface-overlay); border: 1px solid var(--surface-border); border-radius: 8px; box-shadow: 0 8px 24px var(--surface-shadow); }
        .st-menu-item { display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 5px; }
        .st-menu-item--selected { background: var(--accent-subtle); }
        .st-menu-mark { color: var(--accent-text); font-weight: 700; }
        .st-menu-item--muted { color: var(--text-muted); }
      `,
    }),
});
