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
  textAlign?: 'center' | 'end';
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

const interactive = interactionRows(
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

const ALIGNMENTS = ['center', 'end'] as const;

const alignStates = Object.fromEntries(
  ALIGNMENTS.map((textAlign) => [`text-align-${textAlign}`, { ...axisRow, textAlign }]),
) as Record<`text-align-${(typeof ALIGNMENTS)[number]}`, Props>;

const states = { ...interactive.states, ...alignStates };
const grid = {
  columns: interactive.grid.columns,
  rows: {
    ...interactive.grid.rows,
    ...Object.fromEntries(
      ALIGNMENTS.map((textAlign) => [`textAlign ${textAlign}`, { rest: `text-align-${textAlign}` as const }]),
    ),
  },
};

const markControl = (markup: string, control: FieldControl, interaction: FieldInteraction | undefined) => {
  const frame = ['data-et-control-part', interaction && `data-et-force="${interaction}"`].filter(Boolean);
  const native = control === 'input' ? '<input class="et-input-native"' : '<textarea class="et-textarea-native"';

  return markup
    .replace('<et-form-field ', `<et-form-field data-et-control="${control}" `)
    .replace('<div class="et-form-field-control-frame"', `<div class="et-form-field-control-frame" ${frame.join(' ')}`)
    .replace(native, native.replace(' class=', ' data-et-control-part class='));
};

export default definePart<Props>({
  note: 'scale of the decided shape, Q182, lead merge',
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
  render: ({ control = 'input', value, textAlign, interaction, ...field }) =>
    drawing({
      body: markControl(
        formField({
          id: 'name',
          label: 'Name',
          errorColor: 'danger',
          control: control === 'input' ? input({ value, textAlign }) : textarea({ value }),
          ...field,
        }),
        control,
        interaction,
      ),
      styles: formFieldStyles,
    }),
});
