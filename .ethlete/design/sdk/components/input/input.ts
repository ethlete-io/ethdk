import { textInput, type TextInputMockOptions, textInputStyles } from '@ethlete/components/design/input';
import { definePart, drawing } from '@design-system';
import frame from './input.css?inline';

type Props = { field: TextInputMockOptions };

const email = (extra: Partial<TextInputMockOptions> = {}): Props => ({
  field: { id: 'email', label: 'Email', placeholder: 'name@example.com', ...extra },
});

const VALUE = 'lena.hoffmann@example.com';

const INVALID = {
  required: true,
  value: 'lena.hoffmann@',
  error: 'Enter a valid email address.',
  errorColor: 'danger',
} satisfies Partial<TextInputMockOptions>;

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5'],
  states: {
    empty: email({ placeholder: undefined }),
    placeholder: email(),
    filled: email({ value: VALUE }),
    hover: email({ force: 'hover' }),
    'hover-filled': email({ value: VALUE, force: 'hover' }),
    focus: email({ focused: true, force: 'focus-visible' }),
    'focus-filled': email({ value: VALUE, focused: true, force: 'focus-visible' }),
    'focus-hover': email({ value: VALUE, focused: true, force: ['focus-visible', 'hover'] }),
    hint: email({ hint: 'We only use it to sign you in.' }),
    description: email({ description: 'Your team sees this address on your profile.' }),
    required: email({ required: true, hint: 'We only use it to sign you in.' }),
    invalid: email(INVALID),
    'invalid-hover': email({ ...INVALID, force: 'hover' }),
    'invalid-focus': email({ ...INVALID, focused: true, force: 'focus-visible' }),
    'invalid-focus-hover': email({ ...INVALID, focused: true, force: ['focus-visible', 'hover'] }),
    disabled: email({ disabled: true }),
    'disabled-filled': email({ value: VALUE, disabled: true }),
    readonly: email({ value: VALUE, readonly: true }),
    'readonly-hover': email({ value: VALUE, readonly: true, force: 'hover' }),
    'readonly-focus': email({ value: VALUE, readonly: true, focused: true, force: 'focus-visible' }),
    long: email({ value: 'lena.hoffmann-schulze.marketing-department@example-company.com' }),
    'icon-affixes': {
      field: { id: 'key', label: 'API key', placeholder: 'sk-…', prefixIcon: 'lock', suffixIcon: 'check' },
    },
    'text-affixes': {
      field: { id: 'site', label: 'Website', value: 'example.com', prefix: 'https://', suffix: '.de' },
    },
    'text-prefix': {
      field: { id: 'price', label: 'Price', value: '1,250.00', prefix: '€' },
    },
    search: {
      field: { id: 'search', label: 'Search', type: 'search', value: 'running shoes' },
    },
    password: {
      field: { id: 'password', label: 'Password', type: 'password', value: 'correct-horse' },
    },
    'align-end': {
      field: { id: 'amount', label: 'Amount', value: '1,250.00', textAlign: 'end', suffix: 'EUR' },
    },
    mixed: {
      field: { id: 'title', label: 'Title', value: 'shared draft title', mixed: true, mixedLabel: 'Mixed values' },
    },
    'no-label': {
      field: { id: 'quick', placeholder: 'Search…', prefixIcon: 'lock' },
    },
    'size-sm': email({ value: VALUE, size: 'sm' }),
    'size-lg': email({ value: VALUE, size: 'lg' }),
    'align-center': email({ value: VALUE, textAlign: 'center' }),
  },
  widths: [320, 360, 640],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: textInput(props.field),
      styles: [textInputStyles, frame].join('\n'),
    }),
});
