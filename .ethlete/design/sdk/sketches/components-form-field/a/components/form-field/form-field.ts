import { formField, formFieldStyles, input } from '@ethlete/components/design/form-field';
import { definePart, drawing, interactionRows } from '@design-system';
import styles from './form-field.css?inline';

type FieldInteraction = 'hover' | 'active' | 'focus-visible';

type Props = {
  value?: string;
  hint?: string;
  error?: string;
  focused?: boolean;
  disabled?: boolean;
  interaction?: FieldInteraction;
};

const { states, grid } = interactionRows<Props, 'empty' | 'filled' | 'error', FieldInteraction>(
  {
    empty: { hint: 'Shown on your profile' },
    filled: { value: 'Ada Lovelace' },
    error: { error: 'This field is required' },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const markControl = (markup: string, interaction: FieldInteraction | undefined) => {
  const frame = ['data-et-control-part', interaction && `data-et-force="${interaction}"`].filter(Boolean);

  return markup
    .replace('<et-form-field ', '<et-form-field data-et-control="input" ')
    .replace('<div class="et-form-field-control-frame"', `<div class="et-form-field-control-frame" ${frame.join(' ')}`)
    .replace('<input class="et-input-native"', '<input data-et-control-part class="et-input-native"');
};

export default definePart<Props>({
  note: 'The SDK form field with a text input, drawn by its mock from @ethlete/components/design.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...states,
    focused: { value: 'Ada', focused: true },
    disabled: { value: 'Ada Lovelace', disabled: true },
  },
  grid,
  widths: [320],
  controls: {
    input: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
  },
  render: ({ value, interaction, ...field }) =>
    drawing({
      body: markControl(
        formField({ id: 'name', label: 'Name', errorColor: 'danger', control: input({ value }), ...field }),
        interaction,
      ),
      styles: [formFieldStyles, styles].join('\n'),
    }),
});
