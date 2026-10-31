import { textareaField, type TextareaFieldMockOptions, textareaFieldStyles } from '@ethlete/components/design/textarea';
import { definePart, drawing } from '@design-system';
import frame from './textarea.css?inline';

type Props = { field: TextareaFieldMockOptions };

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
  note: "The SDK textarea (et-textarea inside et-form-field), first drawing, drawn by textareaField() from @ethlete/components/design/textarea, which wraps formField() and textarea() from the form-field mock and adds the real form-field-textarea-styles sheet (the form-field mock did not load it), max rows, mixed, et-description and forced states. DOM checked against Storybook Textarea Default, ManualResize, FixedWithMaxRows and Mixed. Box appearance, transparent fill, static label, md size, rows 3 with autosize (field-sizing: content) as the lib default; brand theme, danger as the error theme. Hover is forced on the control frame, focus as data-focused plus focus-visible on the native textarea. Fixtures are fictional: Message, placeholder Write something\u2026, a three-line note to Lena, a ten-line note that grows (long-autosize), the same capped at maxRows 4 (scrolls), autosize off with rows 4 and the vertical resize grip, rows 1, mixed values, no label; required with value Hi and error Write at least 20 characters. Widths 320, 360, 640. Measured in Storybook at 360: line-height 21px at 14px, the same as et-input; maxRows 6 caps at 126px (6 lh) and scrolls inside the frame; the frame block padding was 6px, so the first line started 7px under the frame top, against 14.5px on et-input (min-height 50px, centered). Colour numbers are the text input r1 ones, same tokens: rest frame 1.26 / 1.73, focus (primary) 1.33 / 13.50, error frame 2.30 / 1.72, placeholder 46 % 3.00 / 4.48, required marker 1.33 / 13.50. Decided rules that arise: Q88 (focus frame in ink, invalid in danger ink) and Q99a (required marker light-dark(ink, primary)). Lib bugs apart: (L1) the same et-description bug as text input r1, no inline start padding, 13px left of label, value and hint; b and c drew it aligned. Fixed in the lib, as on the text input. (L3) a textarea was top-aligned inside the 50px min-height frame with only the 6px block padding: rows 1 in Storybook Default drew above 7px, below 22px, the text sat 7.5px higher than an et-input value beside it; b and c padded the textarea frame to (min-height - 1 lh - 2 border) / 2 = 13.5px, so one row centres and every first line meets the input's. Fixed in the lib with the same padding (box appearance, static and floating-outside labels): rows 1 centres like et-input at sm, md and lg (md 14.5 / 14.5), and two lines grow the frame by 15px (56 to 71). (L4) autosize off, resize vertical: the native textarea had no min-block-size, dragging the grip up in Storybook ManualResize shrank it to 15px, the placeholder was cut in half while the frame stayed 50px; not drawable as a static state. Fixed in the lib (min-block-size: 1lh): the same drag now stops at 21px, one line. Design: (1) to (4) as text input r1 (rest and error frame under 3:1, placeholder 3.00, readonly looks editable, hover outshines focus in b and c); c carries the same proposals. (5) The resize grip is the Chromium UA glyph at the textarea corner, 13px inside the frame corner, unthemed, it looks lost in the padding. (6) Scrolled content clips at the textarea edge 14.5px (7px before the L3 fix) inside the frame border, with no fade; a mid-scroll line is cut sharp. Not checked: the scrollbar look, headless Chromium hides scrollbars, so a capped textarea shows no scrollbar in shots or Storybook probes. Later rounds, left out here: underline, filled, floating and inline labels, sm and lg, data-warning, the counter, RTL.",
  madeBy: ['claude-opus-5-5'],
  states: {
    empty: message({ placeholder: undefined }),
    placeholder: message(),
    filled: message({ value: VALUE }),
    hover: message({ force: 'hover' }),
    'hover-filled': message({ value: VALUE, force: 'hover' }),
    focus: message({ focused: true, force: 'focus-visible' }),
    'focus-filled': message({ value: VALUE, focused: true, force: 'focus-visible' }),
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
    'manual-resize': message({ value: VALUE, autosize: false, rows: 4 }),
    'manual-resize-overflow': message({ value: LONG, autosize: false, rows: 4 }),
    'single-row': message({ rows: 1, placeholder: 'Add a note…' }),
    mixed: message({ value: VALUE, mixed: true, mixedLabel: 'Mixed values' }),
    'no-label': message({ label: undefined, placeholder: 'Add a comment…' }),
  },
  contrast: {
    exceptions: [
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
      body: `<div class="t-frame">${textareaField(props.field)}</div>`,
      styles: [textareaFieldStyles, frame].join('\n'),
    }),
});
