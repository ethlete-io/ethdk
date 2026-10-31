import {
  formField,
  formFieldStyles,
  input,
  textarea,
  type FormFieldMockOptions,
} from '@ethlete/components/design/form-field';
import { definePart, drawing, interactionRows } from '@design-system';

type FieldInteraction = 'hover' | 'focus-visible';

type FieldControl = 'input' | 'textarea';

type Axes = Pick<FormFieldMockOptions, 'appearance' | 'fill' | 'labelMode' | 'size'>;

type Props = Axes & {
  control?: FieldControl;
  value?: string;
  hint?: string;
  error?: string;
  focused?: boolean;
  disabled?: boolean;
  interaction?: FieldInteraction;
};

const multiLine = 'Ada Lovelace\nAnalytical Engine notes';

const axisRow: Props = { value: 'Ada Lovelace' };

const AXES = {
  appearance: ['box', 'underline'],
  fill: ['transparent', 'filled'],
  labelMode: ['static', 'inline', 'floating-inside', 'floating-outside'],
  size: ['sm', 'md', 'lg'],
} as const satisfies { [K in keyof Axes]-?: readonly NonNullable<Axes[K]>[] };

const axisRows = Object.fromEntries(
  Object.entries(AXES).flatMap(([axis, values]) =>
    values.map((value) => [`${axis}-${value}`, { ...axisRow, [axis]: value }]),
  ),
) as Record<string, Props>;

const { states, grid } = interactionRows(
  {
    empty: { hint: 'Shown on your profile' },
    filled: { value: 'Ada Lovelace' },
    error: { error: 'This field is required' },
    'textarea-empty': { control: 'textarea', hint: 'Shown on your profile' },
    'textarea-filled': { control: 'textarea', value: multiLine },
    'textarea-error': { control: 'textarea', error: 'This field is required' },
    ...axisRows,
  } satisfies Record<string, Props>,
  {
    interactions: ['hover', 'focus-visible'],
    force: (props: Props, interaction: FieldInteraction): Props => ({ ...props, interaction }),
  },
);

const markControl = (markup: string, control: FieldControl, interaction: FieldInteraction | undefined) => {
  const frame = ['data-et-control-part', interaction && `data-et-force="${interaction}"`].filter(Boolean);
  const native = control === 'input' ? '<input class="et-input-native"' : '<textarea class="et-textarea-native"';

  return markup
    .replace('<et-form-field ', `<et-form-field data-et-control="${control}" `)
    .replace('<div class="et-form-field-control-frame"', `<div class="et-form-field-control-frame" ${frame.join(' ')}`)
    .replace(native, native.replace(' class=', ' data-et-control-part class='));
};

export default definePart<Props>({
  note: 'The SDK form field with a text input and a textarea, drawn by its mocks from @ethlete/components/design.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...states,
    focused: { value: 'Ada', focused: true },
    disabled: { value: 'Ada Lovelace', disabled: true },
    'textarea-focused': { control: 'textarea', value: 'Ada', focused: true },
    'textarea-disabled': { control: 'textarea', value: multiLine, disabled: true },
  },
  grid,
  widths: [320],
  controls: {
    input: { kind: 'field', input: ['pointer', 'keyboard'], disabled: true },
    textarea: { kind: 'field', input: ['pointer', 'keyboard'], disabled: true },
  },
  render: ({ control = 'input', value, interaction, ...field }) =>
    drawing({
      body: markControl(
        formField({
          id: 'name',
          label: 'Name',
          errorColor: 'danger-on-light',
          control: control === 'input' ? input({ value }) : textarea({ value }),
          ...field,
        }),
        control,
        interaction,
      ),
      styles: formFieldStyles,
    }),
});
