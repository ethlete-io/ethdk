import { definePart, drawing } from '@design-system';

export default definePart<{ tone: 'ink' | 'accent' | 'surface' }>({
  note: 'Lab colour tokens, the only place a hex value may live.',
  states: { ink: { tone: 'ink' }, accent: { tone: 'accent' }, surface: { tone: 'surface' } },
  render: ({ tone }) =>
    drawing({
      body: `<div class="swatch swatch--${tone}">${tone}</div>`,
      styles: `
        :root { --lab-ink: #1f2937; --lab-accent: #2563eb; --lab-surface: #f3f4f6; }
        .swatch { width: 120px; height: 72px; display: grid; place-items: center; border-radius: 8px; font: 14px sans-serif; }
        .swatch--ink { background: var(--lab-ink); color: var(--lab-surface); }
        .swatch--accent { background: var(--lab-accent); color: var(--lab-surface); }
        .swatch--surface { background: var(--lab-surface); color: var(--lab-ink); }
      `,
    }),
});
