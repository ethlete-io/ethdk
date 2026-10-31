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
  note: 'The SDK text input (et-input inside et-form-field), first drawing, drawn by textInput() from @ethlete/components/design/input, which wraps formField() and input() from the form-field mock with the real markup and CSS: et-label with the required marker, the control frame with prefix and suffix affixes, et-description, the support row with hint and error; the box appearance, transparent fill, static label, md size; the brand theme, danger as the error theme. Hover is forced on the control frame, focus as data-focused plus focus-visible on the native input. Fixtures are fictional: Email, lena.hoffmann@example.com, placeholder name@example.com, hint We only use it to sign you in., description Your team sees this address on your profile., required with value lena.hoffmann@ and error Enter a valid email address.; API key with the lock and check icons; Website with https:// and .de text affixes; search, password, end-aligned amount with EUR, a mixed bulk-edit value, and an unlabelled field. Framed as a page with 16px padding at 320, 360 and 640. Numbers (light / dark), from shot pixels at scale 2 at 360, brand mint, a: rest frame (surface border) vs page 1.26 / 1.73, the only edge of an empty field; hover frame (surface-interaction-hover) 10.37 / 13.07; focus frame (primary) 1.33 / 13.50; error frame (danger at 50 %) 2.30 / 1.72, error hover (danger ink) 6.47 / 6.48; placeholder (46 % of the text colour) 3.00 / 4.48; required marker (brand primary) 1.33 / 13.50; readonly frame and text identical to filled (1.26 / 1.73, 17.93 / 17.18). Decided rules that arise: Q88 (focus in ink: the focus frame takes ink, the invalid one the danger ink) and Q99a (a mint mark on light takes ink: the required marker light-dark(ink, primary)). Lib bugs apart: (L1) et-description had no inline start padding: it started at the frame edge, 13px left of the label, the value and the hint (Storybook Description at 360: description x 42, label, input and hint x 55); b and c drew it aligned. Fixed in the lib (et-description takes the control inline padding plus the border width): its text starts at x 55 with the label, value and hint, in every variant. (L2) type search showed the Chromium native cancel button (an unthemed UA glyph) on focus, nothing in the lib styled it (shot in Storybook Input Default with type search, focused; a forced focus in a sketch does not draw it). Fixed in the lib (appearance: none on the cancel button): a focused search input with a value shows no UA glyph. Design: (1) WCAG 1.4.11: the rest frame 1.26 / 1.73 and the error frame 2.30 / 1.72 are under 3:1; c answers both. (2) Placeholder 3.00 in light, under 4.5:1; c draws it at 60 %, 4.67 / 6.77. (3) Readonly looks exactly like an editable filled field and gets neither hover nor focus; c proposes a dashed frame (my proposal, not a decided rule). (4) Hover (10.37 / 13.07) outshines the focus frame (5.48 / 13.50) in b and c, as on the otp input; in c the rest frame 4.74 sits close to the focus 5.48 in light, told apart by hue only. (5) A text prefix sits a full affix gap from the value (https://  example.com), so a URL prefix reads as a separate word. (6) The error marker 3.71 in dark, exempted as in checkbox r1. Later rounds, left out here: underline appearance, filled fill, the floating and inline label modes, sm and lg sizes, data-warning, the counter, the busy spinner, browser autofill colours, RTL and the support animation.',
  madeBy: ['claude-opus-5-5'],
  states: {
    empty: email({ placeholder: undefined }),
    placeholder: email(),
    filled: email({ value: VALUE }),
    hover: email({ force: 'hover' }),
    'hover-filled': email({ value: VALUE, force: 'hover' }),
    focus: email({ focused: true, force: 'focus-visible' }),
    'focus-filled': email({ value: VALUE, focused: true, force: 'focus-visible' }),
    hint: email({ hint: 'We only use it to sign you in.' }),
    description: email({ description: 'Your team sees this address on your profile.' }),
    required: email({ required: true, hint: 'We only use it to sign you in.' }),
    invalid: email(INVALID),
    'invalid-hover': email({ ...INVALID, force: 'hover' }),
    'invalid-focus': email({ ...INVALID, focused: true, force: 'focus-visible' }),
    disabled: email({ disabled: true }),
    'disabled-filled': email({ value: VALUE, disabled: true }),
    readonly: email({ value: VALUE, readonly: true }),
    'readonly-focus': email({ value: VALUE, readonly: true, focused: true, force: 'focus-visible' }),
    long: email({ value: 'lena.hoffmann-schulze.marketing-department@example-company.com' }),
    'icon-affixes': {
      field: { id: 'key', label: 'API key', placeholder: 'sk-…', prefixIcon: 'lock', suffixIcon: 'check' },
    },
    'text-affixes': {
      field: { id: 'site', label: 'Website', value: 'example.com', prefix: 'https://', suffix: '.de' },
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
  },
  contrast: {
    exceptions: [
      {
        selector: 'et-form-field:not([data-error]) .et-label-required-marker',
        reason:
          'The required marker takes the brand primary, mint: 1.33:1 in light. Finding, drawn as is in a; b and c draw it in ink (Q99a).',
      },
      {
        selector: 'et-form-field[data-error] .et-label-required-marker',
        reason:
          'The required marker takes the error theme primary: 3.71:1 in dark, under 4.5:1. An open point (checkbox r1 finding 3), not a decided rule.',
      },
    ],
  },
  widths: [320, 360, 640],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${textInput(props.field)}</div>`,
      styles: [textInputStyles, frame].join('\n'),
    }),
});
