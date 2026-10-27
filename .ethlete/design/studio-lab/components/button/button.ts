import { definePart, drawing } from '@design-system';

type Props = { label: string; variant: 'solid' | 'outline' };

export default definePart<Props>({
  note: 'Lab button: solid or outline, with hover, focus-visible, active and disabled.',
  states: {
    solid: { label: 'Save', variant: 'solid' },
    outline: { label: 'Cancel', variant: 'outline' },
  },
  interactions: ['hover', 'focus-visible', 'active', 'disabled'],
  render: ({ label, variant }) =>
    drawing({
      body: `<button class="lab-button lab-button--${variant}">${label}</button>`,
      styles: `
        .lab-button { padding: 8px 16px; border-radius: 6px; font: 600 14px sans-serif; border: 2px solid var(--lab-accent, currentColor); cursor: pointer; }
        .lab-button--solid { background: var(--lab-accent); color: var(--lab-surface); }
        .lab-button--outline { background: transparent; color: var(--lab-accent); }
        .lab-button--solid:hover:not(:disabled) { background: color-mix(in srgb, var(--lab-accent) 80%, white); }
        .lab-button--outline:hover:not(:disabled) { background: color-mix(in srgb, var(--lab-accent) 15%, transparent); }
        .lab-button:focus-visible { outline: 2px solid var(--lab-accent); outline-offset: 3px; }
        .lab-button--solid:active:not(:disabled) { background: color-mix(in srgb, var(--lab-accent) 75%, black); }
        .lab-button--outline:active:not(:disabled) { background: color-mix(in srgb, var(--lab-accent) 30%, transparent); }
        .lab-button:disabled { opacity: 0.4; cursor: not-allowed; }
      `,
    }),
});
