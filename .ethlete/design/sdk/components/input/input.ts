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
  describe: {
    empty:
      'The Email field with no value and no placeholder; check that the label sits above an empty, evenly padded box.',
    placeholder:
      'The empty Email field with its placeholder; check that the placeholder reads muted against a typed value.',
    filled:
      'The Email field holding an address; check that the value uses full text color and stays vertically centered.',
    hover: 'The empty Email field under hover; check that the border darkens without shifting the box.',
    'hover-filled': 'The filled Email field under hover; check that the border darkens and the value does not move.',
    focus:
      'The empty Email field with keyboard focus; check that the focus ring shows around the box without resizing it.',
    'focus-filled':
      'The filled Email field with keyboard focus; check that the focus ring shows and the value stays in place.',
    'focus-hover': 'The filled Email field focused and hovered; check that the focus ring wins over the hover border.',
    hint: 'The Email field with a hint below; check that the hint sits under the box in muted, smaller text.',
    description:
      'The Email field with a description; check that the description reads as help text near the label, apart from the box.',
    required: 'The required Email field with a hint; check that the required mark shows next to the label.',
    invalid:
      'A required field with a broken address and an error; check that the border and error text use the danger color.',
    'invalid-hover':
      'The invalid field under hover; check that the danger border stays and does not fall back to neutral.',
    'invalid-focus': 'The invalid field with keyboard focus; check that the focus ring takes the danger color.',
    'invalid-focus-hover':
      'The invalid field focused and hovered; check that the danger focus ring still wins over hover.',
    disabled: 'The empty Email field disabled; check that box, label and placeholder fade and no hover shows.',
    'disabled-filled': 'The filled Email field disabled; check that the value fades with the box but stays readable.',
    readonly:
      'The filled Email field read-only; check that it looks static, unlike the editable box, but the value stays clear.',
    'readonly-hover': 'The read-only field under hover; check that hover gives no edit cue.',
    'readonly-focus':
      'The read-only field with keyboard focus; check that a focus ring still shows for keyboard users.',
    long: 'The Email field holding a very long address; check that the value clips inside the box and never widens it.',
    'icon-affixes':
      'The API key field with a lock and a check icon; check that both icons sit inside the box, centered on the text.',
    'text-affixes':
      'The Website field with https:// and .de affixes; check that the affixes read muted and frame the value.',
    'text-prefix': 'The Price field with a € prefix; check that the prefix sits before the value with a steady gap.',
    search:
      'A search-type field with a query; check that it looks like the other fields, without a stray browser clear icon.',
    password: 'A password field; check that the value shows as masked dots at the same height as text.',
    'align-end':
      'The Amount field aligned to the end with an EUR suffix; check that the value hugs the suffix on the right.',
    mixed: 'The Title field in the mixed state; check that the Mixed values label shows instead of a single value.',
    'no-label':
      'A field without a label, with a lock icon and placeholder; check that the box keeps its height with no label space.',
    'size-sm': 'The filled Email field at size sm; check that the box and text shrink together and stay centered.',
    'size-lg': 'The filled Email field at size lg; check that the box and text grow together and stay centered.',
    'align-center': 'The filled Email field with centered text; check that the value sits in the middle of the box.',
  },
  widths: [320, 360, 640],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: textInput(props.field),
      styles: [textInputStyles, frame].join('\n'),
    }),
});
