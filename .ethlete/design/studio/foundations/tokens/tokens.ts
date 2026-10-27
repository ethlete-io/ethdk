import { definePart, drawing, html } from '@design-system';
import tokens from './tokens.css?inline';

const ownTokensOf = (css: string) =>
  [...css.matchAll(/(?<![\w-])--((?:surface|text)[\w-]*):\s*([^;]+);/g)].map(([, name, value]) => ({
    name,
    value: (value ?? '').trim(),
  }));

const tokenList = ownTokensOf(tokens)
  .map(
    ({ name, value }) =>
      html`<li class="st-token">
        <span class="st-chip" style="background: var(--${name})"></span>
        <span class="st-token-name">${name}</span>
        <span class="st-token-value">${value}</span>
      </li>`,
  )
  .join('');

const scene = html`<div class="st-scene">
  <aside class="st-sidebar">
    <span class="st-tag">surface</span>
    <div class="st-nav-title">Library</div>
    <div class="st-nav-item st-nav-item--selected">Components</div>
    <div class="st-nav-item">Elements</div>
    <div class="st-nav-item">Pages</div>
    <div class="st-nav-item">Flows</div>
  </aside>
  <main class="st-canvas">
    <span class="st-tag">surface-sunken</span>
    <article class="st-card">
      <span class="st-tag">surface-raised</span>
      <h3 class="st-card-title">Button</h3>
      <p class="st-card-text">Solid, outline and text. Three sizes.</p>
      <div class="st-card-frame"></div>
    </article>
    <div class="st-popover">
      <span class="st-tag">surface-overlay</span>
      <div class="st-menu-item">Rename</div>
      <div class="st-menu-item">Duplicate</div>
      <div class="st-menu-item st-menu-item--muted">Move to…</div>
    </div>
  </main>
</div>`;

export default definePart<{ theme: 'dark' }>({
  note: 'a looks good',
  madeBy: ['claude-opus-5-5'],
  states: { dark: { theme: 'dark' } },
  render: () =>
    drawing({
      body: html`<div class="st-root">
        <ul class="st-tokens">
          ${tokenList}
        </ul>
        ${scene}
      </div>`,
      styles: `${tokens}
        .st-root { display: flex; gap: 24px; padding: 24px; width: 1040px; box-sizing: border-box; background: var(--surface-sunken); color: var(--text); font: 13px/1.4 system-ui, sans-serif; }
        .st-tokens { list-style: none; margin: 0; padding: 12px; width: 280px; flex: none; display: flex; flex-direction: column; gap: 8px; background: var(--surface); border: 1px solid var(--surface-border); border-radius: 8px; }
        .st-token { display: grid; grid-template-columns: 20px 1fr; column-gap: 8px; align-items: center; }
        .st-chip { grid-row: span 2; width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--surface-border); }
        .st-token-name { font-weight: 600; }
        .st-token-value { color: var(--text-muted); font: 11px/1.3 ui-monospace, monospace; }
        .st-scene { flex: 1; display: flex; height: 420px; border: 1px solid var(--surface-border); border-radius: 8px; overflow: hidden; }
        .st-tag { position: absolute; top: 6px; right: 8px; color: var(--text-muted); font: 10px/1 ui-monospace, monospace; }
        .st-sidebar { position: relative; width: 168px; flex: none; padding: 28px 8px 8px; background: var(--surface); border-right: 1px solid var(--surface-border); }
        .st-nav-title { padding: 4px 8px 8px; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
        .st-nav-item { padding: 6px 8px; border-radius: 6px; }
        .st-nav-item--selected { background: var(--surface-raised); }
        .st-canvas { position: relative; flex: 1; padding: 40px 32px; background: var(--surface-sunken); }
        .st-card { position: relative; width: 260px; padding: 16px; background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: 10px; }
        .st-card-title { margin: 0 0 4px; font-size: 15px; }
        .st-card-text { margin: 0 0 12px; color: var(--text-muted); }
        .st-card-frame { height: 96px; border-radius: 6px; background: var(--surface); }
        .st-popover { position: absolute; left: 230px; top: 150px; width: 180px; padding: 24px 6px 6px; background: var(--surface-overlay); border: 1px solid var(--surface-border); border-radius: 8px; box-shadow: 0 8px 24px var(--surface-shadow); }
        .st-menu-item { padding: 6px 10px; border-radius: 5px; }
        .st-menu-item:first-of-type { background: color-mix(in oklab, var(--text) 8%, var(--surface-overlay)); }
        .st-menu-item--muted { color: var(--text-muted); }
      `,
    }),
});
