import { definePart, drawing, html } from '@design-system';
import sheet, { tokenSheet, fillTokenValues } from '@system/foundations/sheet';
import tokens from './spacing.css?inline';

const names = [...tokens.matchAll(/^\s*--([\w-]+):/gm)].map(([, name]) => name ?? '');

const sampleOf = (name: string) => {
  if (name.startsWith('space-')) return html`<span class="sp-bar" style="width: var(--${name})"></span>`;
  if (name.startsWith('radius-')) return html`<span class="sp-radius" style="border-radius: var(--${name})"></span>`;

  return html`<span class="sp-height" style="height: var(--${name})">${name}</span>`;
};

const sample = html`<div class="sp-cluster">
  <span class="sp-height" style="height: var(--control-sm)">control-sm</span>
  <span class="sp-height" style="height: var(--control-md)">control-md</span>
  <span class="sp-height sp-height--row" style="height: var(--row)">row</span>
  <span class="sp-stack">
    <span class="sp-gap" style="gap: var(--space-1)"><i></i><i></i><i></i>space-1</span>
    <span class="sp-gap" style="gap: var(--space-3)"><i></i><i></i><i></i>space-3</span>
  </span>
</div>`;

export default definePart({
  note: 'The Studio spacing, radius and control heights on their own sheet, split from foundations/tokens.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra'],
  states: { scale: {} },
  render: () =>
    drawing({
      body: tokenSheet({ title: 'Spacing, radius and heights', sample, names, sampleOf }),
      setup: (root) => fillTokenValues(root, true),
      styles: `${sheet.styles}
        .sp-cluster { display: flex; flex-wrap: wrap; align-items: flex-end; gap: var(--space-5); }
        .sp-stack { display: flex; flex-direction: column; gap: var(--space-3); }
        .sp-bar { display: block; height: var(--space-2); background: var(--accent); border-radius: 2px; }
        .sp-radius { width: 40px; height: 40px; background: var(--surface-raised); border: 1px solid var(--accent); }
        .sp-height { display: inline-flex; align-items: center; padding: 0 var(--space-2); box-sizing: border-box; background: var(--surface-raised); border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .sp-height--row { min-width: 200px; background: var(--accent-subtle); color: var(--text); }
        .sp-gap { display: flex; align-items: center; font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .sp-gap i { width: var(--space-4); height: var(--space-4); background: var(--accent); border-radius: 2px; }
      `,
    }),
});
