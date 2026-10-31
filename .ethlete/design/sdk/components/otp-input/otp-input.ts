import { otpInput, type OtpInputMockOptions, otpInputStyles } from '@ethlete/components/design/otp-input';
import { definePart, drawing } from '@design-system';
import frame from './otp-input.css?inline';

type Props = { field: OtpInputMockOptions };

const code = (extra: Partial<OtpInputMockOptions> = {}): Props => ({
  field: { id: 'code', label: 'Verification code', ...extra },
});

const pin = (extra: Partial<OtpInputMockOptions> = {}): Props => ({
  field: { id: 'pin', label: 'PIN', length: 4, masked: true, ...extra },
});

const INVALID = {
  required: true,
  error: 'Enter the code from the SMS.',
  errorColor: 'danger',
} satisfies Partial<OtpInputMockOptions>;

export default definePart({
  note: 'The SDK otp input (et-otp-input), first drawing, drawn by the mock from @ethlete/components/design/otp-input with the real markup and CSS: et-label with the required marker, the segment row, the invisible native input over it, et-form-support with hint and error; the brand theme, danger as the error theme. The field has no :focus or :hover CSS of its own: focus is the data-caret segment (a 1px border plus a 1px inset outline in primary, and a blinking 2px caret bar in an empty one), which the mock draws with focused. Fixtures are fictional: Verification code, 6 digits 482193, hint We sent it to +49 151 0000 0000., required with error Enter the code from the SMS.; a 4-digit masked PIN. Framed as a page with 16px padding at 320, 360 and 640. States: empty, partial, filled, hover, focus-empty, focus-partial, focus-filled, hint, required, invalid, invalid-partial, invalid-focus, disabled, disabled-filled, readonly, readonly-focus, pin-partial and pin-focus. Numbers (light / dark), from shot pixels at scale 2 at 360, brand mint, a: segment 44px outer (border-box, fixed in 00072d935), gap 8px, row 304px, digits 19.8px; empty and filled segment border (surface border) vs page 1.26 / 1.73, the only edge of a segment; caret segment edge and caret bar (primary) 1.33 / 13.50; required marker (brand primary) 1.33 / 13.50; invalid border (danger) 4.83 / 3.71; label (muted) 7.81 / 6.94; disabled digits 2.55 / 3.72 (opacity 0.4, exempt). Decided rules that arise: Q88 (focus in ink: the caret segment edge and the caret bar take ink, the invalid one the danger ink) and Q99a (a mint mark on light takes ink: the required marker light-dark(ink, primary)). Hover follows the text field (form-field-text-shell: the frame border to surface-interaction-hover, the error frame to ink, none when readonly or disabled), on the host since the host is the click target (otp.activate()). The filled segment edge in c is my proposal, not a decided rule (Q103). Findings for later, lib bugs apart: (L1) a 6-digit field needed 304px and never shrank; at 320 with 16px page padding it overflowed by 16px (drawn at 320). Now fixed: the segments shrink, 41.3px at 320, and the render at 640 is unchanged. (L2) a readonly field showed the focus caret segment and, when not full, the blinking caret bar, though nothing can be typed (readonly-focus). Now fixed: no caret when readonly. Design: (1) WCAG 1.4.11: the segment border 1.26 / 1.73 is the only edge of an empty segment, as with the checkbox box and the radio circle. Not drawn. (2) A filled segment looks like an empty one apart from its digit; c answers it. (3) The error border is the full danger primary, while the text field draws its error frame at 50 % danger; kept, it passes 3:1. (4) Hover (10.37 / 13.07) outshines the focus edge (5.48 / 13.50) in b and c, as it does on the text field. (5) The masked dot is a 19.8px bullet, about 5px wide. (6) The error marker 3.71 in dark, exempted as in checkbox r1. Later rounds, left out here: data-warning (no CSS of its own), a coloured field, alphanumeric codes, other lengths and segment sizes via the custom properties, RTL and the pop-in animation.',
  madeBy: ['claude-opus-5-5'],
  states: {
    empty: code(),
    partial: code({ value: '482' }),
    filled: code({ value: '482193' }),
    hover: code({ value: '482', force: 'hover' }),
    'focus-empty': code({ focused: true }),
    'focus-partial': code({ value: '482', focused: true }),
    'focus-filled': code({ value: '482193', focused: true }),
    hint: code({ hint: 'We sent it to +49 151 0000 0000.' }),
    required: code({ required: true, hint: 'We sent it to +49 151 0000 0000.' }),
    invalid: code(INVALID),
    'invalid-partial': code({ ...INVALID, value: '48' }),
    'invalid-focus': code({ ...INVALID, value: '48', focused: true }),
    disabled: code({ disabled: true }),
    'disabled-filled': code({ value: '482193', disabled: true }),
    readonly: code({ value: '482193', readonly: true }),
    'readonly-focus': code({ value: '482', readonly: true, focused: true }),
    'pin-partial': pin({ value: '73' }),
    'pin-focus': pin({ value: '73', focused: true }),
  },
  contrast: {
    exceptions: [
      {
        selector: 'et-otp-input:has(.et-otp-input-native:disabled) .et-otp-input-segment-char',
        reason:
          'A disabled field is exempt under WCAG 1.4.3 (inactive component): opacity 0.4 draws the digits 2.55:1 / 3.72:1.',
      },
      {
        selector: 'et-otp-input[data-error] .et-label-required-marker',
        reason:
          'The required marker takes the error theme primary: 3.71:1 in dark, under 4.5:1. An open point (checkbox r1 finding 3), not a decided rule.',
      },
    ],
  },
  widths: [320, 360, 640],
  frame: (body) => `<div class="t-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: otpInput(props.field),
      styles: [otpInputStyles, frame].join('\n'),
    }),
});
