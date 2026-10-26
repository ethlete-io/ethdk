import { definePart, drawing, ng } from '@design-system';

type ButtonProps = { label: string; disabled: boolean };

export default definePart<ButtonProps>({
  note: 'The SDK button, rendered by ng() and never redrawn.',
  states: {
    default: { label: 'Save', disabled: false },
    disabled: { label: 'Save', disabled: true },
  },
  render: async ({ label, disabled }) =>
    drawing({
      body: await ng(`<button et-button${disabled ? ' disabled' : ''}>${label}</button>`, {
        imports: ['ButtonComponent'],
      }),
      styles: '',
    }),
});
