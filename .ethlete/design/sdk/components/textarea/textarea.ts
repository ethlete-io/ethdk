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

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5'],
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
  widths: [320, 360, 640],
  render: (props: Props) =>
    drawing({
      body: props.scrolled
        ? `<div class="t-frame t-scrolled">${textareaField(props.field).replace('<div class="et-form-field-control-frame"', '$& data-et-skip="CLIPPED"')}</div>`
        : `<div class="t-frame">${textareaField(props.field)}</div>`,
      styles: [textareaFieldStyles, frame].join('\n'),
    }),
});
