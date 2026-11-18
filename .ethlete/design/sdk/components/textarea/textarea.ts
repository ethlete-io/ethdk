import { textareaField, type TextareaFieldMockOptions, textareaFieldStyles } from '@ethlete/components/design/textarea';
import { definePart, drawing } from '@design-system';
import frame from './textarea.css?inline';

type Props = { field: TextareaFieldMockOptions; scrolled?: boolean };

const message = (extra: Partial<TextareaFieldMockOptions> = {}): Props => ({
  field: { id: 'message', label: 'Message', placeholder: 'Write something…', ...extra },
});

const VALUE = 'Hi Lena,\nthe venue moved to Hall B.\nKick-off stays at 18:00.';

const LONG =
  'Hi Lena,\nthe venue moved to Hall B, next to the north entrance.\nKick-off stays at 18:00, doors open at 17:15.\nPlease bring your team list and the signed waiver for every player.\nParking is free after 17:00 on the east lot.\nThe referee briefing starts at 17:30 in room 2.\nSee you there,\nJonas';

const INVALID = {
  required: true,
  value: 'Hi',
  error: 'Write at least 20 characters.',
  errorColor: 'danger',
} satisfies Partial<TextareaFieldMockOptions>;

const markControl = (markup: string) =>
  markup
    .replace('<et-form-field ', '<et-form-field data-et-control="textarea" ')
    .replace('<div class="et-form-field-control-frame"', '$& data-et-control-part')
    .replace('<textarea ', '<textarea data-et-control-part ');

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5', 'design check'],
  states: {
    empty: message({ placeholder: undefined }),
    placeholder: message(),
    filled: message({ value: VALUE }),
    hover: message({ force: 'hover' }),
    'hover-filled': message({ value: VALUE, force: 'hover' }),
    focus: message({ focused: true, force: 'focus-visible' }),
    'focus-filled': message({ value: VALUE, focused: true, force: 'focus-visible' }),
    'focus-hover': message({ value: VALUE, focused: true, force: ['hover', 'focus-visible'] }),
    hint: message({ hint: 'Visible to everyone on the team.' }),
    description: message({ description: 'Shown above the event on the team page.' }),
    required: message({ required: true, hint: 'Visible to everyone on the team.' }),
    invalid: message(INVALID),
    'invalid-hover': message({ ...INVALID, force: 'hover' }),
    'invalid-focus': message({ ...INVALID, focused: true, force: 'focus-visible' }),
    disabled: message({ disabled: true }),
    'disabled-filled': message({ value: VALUE, disabled: true }),
    readonly: message({ value: VALUE, readonly: true }),
    'readonly-focus': message({ value: VALUE, readonly: true, focused: true, force: 'focus-visible' }),
    'long-autosize': message({ value: LONG }),
    'long-max-rows': message({ value: LONG, maxRows: 4 }),
    'long-max-rows-scrolled': { ...message({ value: LONG, maxRows: 4 }), scrolled: true },
    'manual-resize': message({ value: VALUE, autosize: false, rows: 4 }),
    'manual-resize-overflow': message({ value: LONG, autosize: false, rows: 4 }),
    'single-row': message({ rows: 1, placeholder: 'Add a note…' }),
    mixed: message({ value: VALUE, mixed: true, mixedLabel: 'Mixed values' }),
    'no-label': message({ label: undefined, placeholder: 'Add a comment…' }),
    'size-sm': message({ value: VALUE, size: 'sm' }),
    'size-lg': message({ value: VALUE, size: 'lg' }),
  },
  describe: {
    empty:
      'The Message textarea with no value or placeholder; check that the label sits above an empty, evenly padded box.',
    placeholder: 'The empty textarea with its placeholder; check that the placeholder reads muted.',
    filled: 'The textarea holding three lines; check that the box grows to fit them.',
    hover: 'The empty textarea hovered; check that the border darkens without shifting the box.',
    'hover-filled': 'The filled textarea hovered; check that the border darkens and the text stays put.',
    focus: 'The empty textarea focused by keyboard; check that the focus ring shows without resizing the box.',
    'focus-filled': 'The filled textarea focused by keyboard; check that the ring shows around the grown box.',
    'focus-hover': 'The filled textarea focused and hovered; check that the focus ring wins over hover.',
    hint: 'The textarea with a hint; check that the hint sits under the box in muted text.',
    description: 'The textarea with a description; check that it reads as help text apart from the box.',
    required: 'The required textarea with a hint; check that the required mark shows next to the label.',
    invalid: 'A required textarea with too little text; check that the border and error text use the danger color.',
    'invalid-hover': 'The invalid textarea hovered; check that the danger border stays.',
    'invalid-focus': 'The invalid textarea focused; check that the focus ring takes the danger color.',
    disabled: 'The empty textarea disabled; check that box, label and placeholder fade.',
    'disabled-filled': 'The filled textarea disabled; check that the text fades but stays readable.',
    readonly: 'The filled textarea read-only; check that it looks static and the text stays clear.',
    'readonly-focus': 'The read-only textarea focused by keyboard; check that a focus ring still shows.',
    'long-autosize': 'Eight lines with autosize; check that the box grows to show every line with no scrollbar.',
    'long-max-rows': 'Eight lines capped at four rows; check that the box stops at four rows and scrolls.',
    'long-max-rows-scrolled':
      'The capped textarea scrolled down; check that later lines show and the box keeps four rows.',
    'manual-resize': 'Three lines in a fixed four-row box; check the resize handle in the corner.',
    'manual-resize-overflow': 'Eight lines in a fixed four-row box; check that the text scrolls inside it.',
    'single-row': 'A one-row textarea with a placeholder; check that it starts at one line tall.',
    mixed: 'The textarea in the mixed state; check that the Mixed values label shows instead of the text.',
    'no-label': 'A textarea without a label; check that the box keeps its padding with no label space.',
    'size-sm': 'The filled textarea at size sm; check that padding and text shrink together.',
    'size-lg': 'The filled textarea at size lg; check that padding and text grow together.',
  },
  widths: [320, 360, 640],
  controls: {
    textarea: { kind: 'field', part: 'components/form-field', disabled: true },
  },
  motions: {
    'hover-in': { from: 'empty', to: 'hover' },
    'hover-out': { from: 'hover', to: 'empty' },
    'hover-in-filled': { from: 'filled', to: 'hover-filled' },
    'hover-out-filled': { from: 'hover-filled', to: 'filled' },
    'hover-in-invalid': { from: 'invalid', to: 'invalid-hover' },
    'hover-out-invalid': { from: 'invalid-hover', to: 'invalid' },
    disable: { from: 'empty', to: 'disabled' },
    enable: { from: 'disabled', to: 'empty' },
    'disable-hovered': { from: 'hover', to: 'disabled' },
    'enable-hovered': { from: 'disabled', to: 'hover' },
    'disable-filled': { from: 'filled', to: 'disabled-filled' },
    'enable-filled': { from: 'disabled-filled', to: 'filled' },
    'disable-hovered-filled': { from: 'hover-filled', to: 'disabled-filled' },
    'enable-hovered-filled': { from: 'disabled-filled', to: 'hover-filled' },
  },
  frame: (body, props) => `<div class="t-frame ${props.scrolled ? 't-scrolled' : ''}">${body}</div>`,
  scrolls: ['long-max-rows', 'manual-resize-overflow'],
  render: (props: Props) =>
    drawing({
      body: props.scrolled
        ? markControl(textareaField(props.field)).replace(
            '<div class="et-form-field-control-frame"',
            '$& data-et-skip="CLIPPED"',
          )
        : markControl(textareaField(props.field)),
      styles: [textareaFieldStyles, frame].join('\n'),
    }),
});
