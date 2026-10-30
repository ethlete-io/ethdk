import { definePart, drawing, html } from '@design-system';
import sheet, { tokenSheet, fillTokenValues } from '@system/foundations/sheet';
import tokens from './motion.css?inline';

const names = [...tokens.matchAll(/^\s*--([\w-]+):/gm)].map(([, name]) => name ?? '');

const steps = [0, 25, 50, 75, 100];

const fade = (label: string, cell: (step: number) => string) =>
  html`<div class="mo-strip">
    <span class="mo-label">${label}</span>
    ${steps.map((step) => html`<span class="mo-step">${cell(step)}<span class="mo-time">${step}%</span></span>`).join('')}
  </div>`;

const sample = html`<div class="mo-sample">
  ${fade(
    'state · hover fill',
    (step) =>
      html`<span
        class="mo-cell"
        style="background: color-mix(in oklch, var(--surface), var(--surface-raised) ${step}%)"
      ></span>`,
  )}
  ${fade('appear · opacity', (step) => html`<span class="mo-cell mo-cell--appear" style="opacity: ${step / 100}"></span>`)}
</div>`;

const sampleOf = (name: string) => {
  if (name.startsWith('duration-'))
    return html`<span class="mo-bar" style="width: calc(var(--${name}) / 1ms * 1px)"></span>`;
  if (name === 'transition-state') return html`<span class="mo-hint">background, color, border, shadow</span>`;

  return html`<span class="mo-hint">${name === 'ease-standard' ? 'every state and appear fade' : ''}</span>`;
};

export default definePart({
  note: 'The Studio duration and easing tokens. An interaction state fades its colours; an appearing element fades its opacity. No scale or slide.',
  madeBy: ['claude-opus-5-5'],
  states: { scale: {} },
  render: () =>
    drawing({
      body: tokenSheet({ title: 'Motion', sample, names, sampleOf }),
      setup: (root) => fillTokenValues(root),
      styles: `${sheet.styles}
        .mo-sample { display: flex; flex-direction: column; gap: var(--space-3); }
        .mo-strip { display: flex; align-items: flex-end; gap: var(--space-3); }
        .mo-label { width: 160px; font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .mo-step { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); }
        .mo-cell { display: block; width: 64px; height: var(--row); border: 1px solid var(--surface-border); border-radius: var(--radius-control-sm); box-sizing: border-box; }
        .mo-cell--appear { background: var(--surface-raised); }
        .mo-time { font-family: var(--font-code); font-size: var(--text-xs); line-height: var(--text-xs-line); color: var(--text-muted); }
        .mo-bar { display: block; height: var(--space-2); background: var(--accent); border-radius: 2px; }
        .mo-hint { font-size: var(--text-sm); line-height: var(--text-sm-line); color: var(--text-muted); }
      `,
    }),
});
