import { definePart, drawing, html } from '@design-system';
import sheet, { fillTokenValues, tokenSheet } from '@system/foundations/sheet';
import tokens from './type.css?inline';

const names = [...tokens.matchAll(/^\s*--([\w-]+):/gm)].map(([, name]) => name ?? '');

const steps = ['xs', 'sm', 'md', 'lg', 'xl'];

const sampleOf = (name: string) => {
  if (name.startsWith('font-')) return html`<span style="font-family: var(--${name})">Aa 0123 {}</span>`;
  if (name.startsWith('weight-')) return html`<span style="font-weight: var(--${name})">Merge sketch</span>`;
  if (name.endsWith('-line'))
    return html`<span class="ty-line" style="font-size: var(--${name.slice(0, -5)}); line-height: var(--${name})"
      >Pick variant</span
    >`;

  return html`<span style="font-size: var(--${name}); line-height: var(--${name}-line)">Pick variant</span>`;
};

const typeSample = (step: string) =>
  html`<div class="ty-step">
    <span class="ts-name">--text-${step}</span
    ><span class="ts-value"
      ><span data-token="text-${step}"></span> / <span data-token="text-${step}-line"></span
    ></span>
    <span class="ty-step-text ty-line" style="font-size: var(--text-${step}); line-height: var(--text-${step}-line)"
      >foundations/type · Pick variant</span
    >
  </div>`;

export default definePart({
  note: 'The Studio type scale, fonts and weights on their own sheet, split from foundations/tokens.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra'],
  states: { scale: {} },
  render: () =>
    drawing({
      body: tokenSheet({
        title: 'Type scale',
        sample: steps.map(typeSample).join(''),
        sampleClass: 'ty-stack',
        names,
        sampleOf,
      }),
      setup: (root) => fillTokenValues(root, true),
      styles: `${sheet.styles}
        .ty-stack { display: flex; flex-direction: column; gap: var(--space-3); }
        .ty-step { display: grid; grid-template-columns: 120px 300px 1fr; align-items: center; gap: var(--space-3); }
        .ty-step-text { min-width: 0; }
        .ty-line { background: var(--accent-subtle); }
      `,
    }),
});
