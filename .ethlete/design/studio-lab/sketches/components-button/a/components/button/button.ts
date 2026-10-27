import { definePart, drawing } from '@design-system';

type Props = { label: string; variant: 'solid' | 'outline'; disabled: boolean; hover: boolean };

export default definePart<Props>({
  note: 'Lab button, variant A pill: solid or outline, with hover and disabled.',
  states: {
    solid: { label: 'Save', variant: 'solid', disabled: false, hover: false },
    outline: { label: 'Cancel', variant: 'outline', disabled: false, hover: false },
    hover: { label: 'Save', variant: 'solid', disabled: false, hover: true },
    disabled: { label: 'Save', variant: 'solid', disabled: true, hover: false },
  },
  render: ({ label, variant, disabled, hover }) =>
    drawing({
      body: `<button class="lab-button lab-button--${variant}${hover ? ' is-hover' : ''}"${disabled ? ' disabled' : ''}>${label}</button>`,
      styles: `
        .lab-button { padding: 8px 16px; border-radius: 999px; font: 600 14px sans-serif; border: 2px solid var(--lab-accent, currentColor); cursor: pointer; }
        .lab-button--solid { background: var(--lab-accent); color: var(--lab-surface); }
        .lab-button--outline { background: transparent; color: var(--lab-accent); }
        .lab-button.is-hover { opacity: 0.8; }
        .lab-button:disabled { opacity: 0.4; cursor: not-allowed; }
      `,
    }),
});
