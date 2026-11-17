import { definePart, drawing } from '@design-system';

export default definePart<{ tone: 'ink' | 'accent' | 'surface' }>({
  note: 'Lab colour tokens, the only place a hex value may live.',
  states: { ink: { tone: 'ink' }, accent: { tone: 'accent' }, surface: { tone: 'surface' } },
  describe: {
    ink: 'The ink token as a light swatch with its name in the surface colour; check that the dark label reads clearly on it.',
    accent:
      'The accent token as a swatch with its name in the surface colour; check that the label keeps its contrast on the accent.',
    surface:
      'The surface token as a dark swatch with its name in ink; check that the swatch stays distinct from the darker page background.',
  },
  render: ({ tone }) =>
    drawing({
      body: `<div class="swatch swatch--${tone}">${tone}</div>`,
      styles: `
        .swatch { width: 120px; height: 72px; display: grid; place-items: center; border-radius: 8px; font: 14px var(--font-ui); }
        .swatch--ink { background: var(--lab-ink); color: var(--lab-surface); }
        .swatch--accent { background: var(--lab-accent); color: var(--lab-surface); }
        .swatch--surface { background: var(--lab-surface); color: var(--lab-ink); }
      `,
    }),
});
