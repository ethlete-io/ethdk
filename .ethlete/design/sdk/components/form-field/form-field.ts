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

const ALIGNMENTS = ['center', 'end'] as const;

const alignRows = Object.fromEntries(
  ALIGNMENTS.map((textAlign) => [`text-align-${textAlign}`, { ...axisRow, textAlign }]),
) as Record<`text-align-${(typeof ALIGNMENTS)[number]}`, Props>;

const interactive = interactionRows(
  {
    empty: { hint: 'Shown on your profile' },
    filled: { value: 'Ada Lovelace' },
    error: { error: 'This field is required' },
    'textarea-empty': { control: 'textarea', hint: 'Shown on your profile' },
    'textarea-filled': { control: 'textarea', value: multiLine },
    'textarea-error': { control: 'textarea', error: 'This field is required' },
    ...axisRows,
    ...alignRows,
  } satisfies Record<string, Props>,
  {
    interactions: ['hover', 'focus-visible'],
    force: (props: Props, interaction: FieldInteraction): Props => ({ ...props, interaction }),
  },
);

const states = interactive.states;
const grid = interactive.grid;

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
  describe: {
    empty: 'The empty Name input with a hint; check the label, the empty field and the hint.',
    'empty-hover': 'The empty Name input with a hint, hovered; check that the field edge changes from rest.',
    'empty-focus-visible':
      'The empty Name input with a hint, with keyboard focus; check the focus edge in the primary colour.',
    filled: 'The Name input with Ada Lovelace; check the value inside the field.',
    'filled-hover': 'The Name input with Ada Lovelace, hovered; check that the field edge changes from rest.',
    'filled-focus-visible':
      'The Name input with Ada Lovelace, with keyboard focus; check the focus edge in the primary colour.',
    error: 'The empty Name input with an error; check the danger edge and the error under it.',
    'error-hover': 'The empty Name input with an error, hovered; check that the field edge changes from rest.',
    'error-focus-visible':
      'The empty Name input with an error, with keyboard focus; check the focus edge in the primary colour.',
    'textarea-empty': 'The empty Name textarea with a hint; check the taller field and the hint.',
    'textarea-empty-hover':
      'The empty Name textarea with a hint, hovered; check that the field edge changes from rest.',
    'textarea-empty-focus-visible':
      'The empty Name textarea with a hint, with keyboard focus; check the focus edge in the primary colour.',
    'textarea-filled': 'The Name textarea with two lines; check that both lines show inside the field.',
    'textarea-filled-hover': 'The Name textarea with two lines, hovered; check that the field edge changes from rest.',
    'textarea-filled-focus-visible':
      'The Name textarea with two lines, with keyboard focus; check the focus edge in the primary colour.',
    'textarea-error': 'The empty Name textarea with an error; check the danger edge and the error under it.',
    'textarea-error-hover':
      'The empty Name textarea with an error, hovered; check that the field edge changes from rest.',
    'textarea-error-focus-visible':
      'The empty Name textarea with an error, with keyboard focus; check the focus edge in the primary colour.',
    'appearance-box':
      'The filled Name input with appearance box; check how appearance box draws the field and its label.',
    'appearance-box-hover':
      'The filled Name input with appearance box, hovered; check that the field edge changes from rest.',
    'appearance-box-focus-visible':
      'The filled Name input with appearance box, with keyboard focus; check the focus edge in the primary colour.',
    'appearance-underline':
      'The filled Name input with appearance underline; check how appearance underline draws the field and its label.',
    'appearance-underline-hover':
      'The filled Name input with appearance underline, hovered; check that the field edge changes from rest.',
    'appearance-underline-focus-visible':
      'The filled Name input with appearance underline, with keyboard focus; check the focus edge in the primary colour.',
    'fill-transparent':
      'The filled Name input with fill transparent; check how fill transparent draws the field and its label.',
    'fill-transparent-hover':
      'The filled Name input with fill transparent, hovered; check that the field edge changes from rest.',
    'fill-transparent-focus-visible':
      'The filled Name input with fill transparent, with keyboard focus; check the focus edge in the primary colour.',
    'fill-filled': 'The filled Name input with fill filled; check how fill filled draws the field and its label.',
    'fill-filled-hover':
      'The filled Name input with fill filled, hovered; check that the field edge changes from rest.',
    'fill-filled-focus-visible':
      'The filled Name input with fill filled, with keyboard focus; check the focus edge in the primary colour.',
    'labelMode-static':
      'The filled Name input with labelMode static; check how labelMode static draws the field and its label.',
    'labelMode-static-hover':
      'The filled Name input with labelMode static, hovered; check that the field edge changes from rest.',
    'labelMode-static-focus-visible':
      'The filled Name input with labelMode static, with keyboard focus; check the focus edge in the primary colour.',
    'labelMode-inline':
      'The filled Name input with labelMode inline; check how labelMode inline draws the field and its label.',
    'labelMode-inline-hover':
      'The filled Name input with labelMode inline, hovered; check that the field edge changes from rest.',
    'labelMode-inline-focus-visible':
      'The filled Name input with labelMode inline, with keyboard focus; check the focus edge in the primary colour.',
    'labelMode-floating-inside':
      'The filled Name input with labelMode floating-inside; check how labelMode floating-inside draws the field and its label.',
    'labelMode-floating-inside-hover':
      'The filled Name input with labelMode floating-inside, hovered; check that the field edge changes from rest.',
    'labelMode-floating-inside-focus-visible':
      'The filled Name input with labelMode floating-inside, with keyboard focus; check the focus edge in the primary colour.',
    'labelMode-floating-outside':
      'The filled Name input with labelMode floating-outside; check how labelMode floating-outside draws the field and its label.',
    'labelMode-floating-outside-hover':
      'The filled Name input with labelMode floating-outside, hovered; check that the field edge changes from rest.',
    'labelMode-floating-outside-focus-visible':
      'The filled Name input with labelMode floating-outside, with keyboard focus; check the focus edge in the primary colour.',
    'size-sm': 'The filled Name input with size sm; check how size sm draws the field and its label.',
    'size-sm-hover': 'The filled Name input with size sm, hovered; check that the field edge changes from rest.',
    'size-sm-focus-visible':
      'The filled Name input with size sm, with keyboard focus; check the focus edge in the primary colour.',
    'size-md': 'The filled Name input with size md; check how size md draws the field and its label.',
    'size-md-hover': 'The filled Name input with size md, hovered; check that the field edge changes from rest.',
    'size-md-focus-visible':
      'The filled Name input with size md, with keyboard focus; check the focus edge in the primary colour.',
    'size-lg': 'The filled Name input with size lg; check how size lg draws the field and its label.',
    'size-lg-hover': 'The filled Name input with size lg, hovered; check that the field edge changes from rest.',
    'size-lg-focus-visible':
      'The filled Name input with size lg, with keyboard focus; check the focus edge in the primary colour.',
    'text-align-center': 'The value centred in the field; check that it sits centred.',
    'text-align-end': 'The value aligned to the end; check that it sits at the end.',
    focused: 'The input focused with Ada; check the focus edge and the caret after the value.',
    disabled: 'The disabled input with Ada Lovelace; check that field and label fade.',
    'textarea-focused': 'The textarea focused with Ada; check the focus edge around the taller field.',
    'textarea-disabled': 'The disabled textarea with two lines; check that field, value and label fade.',
  },
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
