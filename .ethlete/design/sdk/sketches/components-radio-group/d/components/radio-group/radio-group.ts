import {
  radioGroup,
  type RadioGroupMockOption,
  type RadioGroupMockOptions,
  type RadioMockForce,
  radioGroupStyles,
} from '@ethlete/components/design/radio-group';
import { definePart, drawing } from '@design-system';
import frame from './radio-group.css?inline';

type Props = { group: RadioGroupMockOptions };

const LABEL = 'Remind me one hour before';

const ROWS = {
  unchecked: {},
  checked: { checked: true },
} satisfies Record<string, Partial<RadioGroupMockOption>>;

const COLUMNS = ['rest', 'hover', 'focus-visible', 'active', 'disabled', 'readonly'] as const;

type Row = keyof typeof ROWS;
type Column = (typeof COLUMNS)[number];

const cellOf = (row: Row, column: Column): RadioGroupMockOptions => ({
  id: `${row}-${column}`,
  readonly: column === 'readonly',
  options: [
    {
      ...ROWS[row],
      label: LABEL,
      disabled: column === 'disabled',
      force:
        column === 'rest' || column === 'disabled' || column === 'readonly'
          ? undefined
          : (column satisfies RadioMockForce),
    },
  ],
});

const stateOf = (row: Row, column: Column) => (column === 'rest' ? row : `${row}-${column}`);

const gridStates = Object.fromEntries(
  (Object.keys(ROWS) as Row[]).flatMap((row) =>
    COLUMNS.map((column) => [stateOf(row, column), { group: cellOf(row, column) }]),
  ),
) as Record<string, Props>;

const REMINDERS = ['One hour before', 'Fifteen minutes before', 'At kick-off'];

const reminderGroup = (
  checked: number | null,
  extra: Partial<RadioGroupMockOptions> & { force?: RadioMockForce[] } = {},
): RadioGroupMockOptions => {
  const { force, ...rest } = extra;

  return {
    id: 'reminder',
    label: 'Kick-off reminder',
    ...rest,
    options: REMINDERS.map((label, index) => ({
      label,
      checked: index === checked,
      force: index === 1 ? force : undefined,
    })),
  };
};

const formatGroup = (checked: number | null, force?: RadioMockForce[]): RadioGroupMockOptions => ({
  id: 'format',
  label: 'Match report format',
  variant: 'card',
  options: [
    { label: 'Short', description: 'The score and the scorers.', checked: checked === 0, force },
    { label: 'Full', description: 'Every event, with the line-ups.', checked: checked === 1 },
  ],
});

const INVALID = {
  required: true,
  error: 'Pick a reminder to continue.',
  errorColor: 'danger',
} satisfies Partial<RadioGroupMockOptions>;

export default definePart({
  note: 'The SDK radio group (et-radio-group with et-radio) in flow, first drawing, drawn by the mock from @ethlete/components/design/radio-group with the real markup and CSS: et-label, et-radio in the plain and the card variant (et-selection-card), et-description, et-form-support with hint and error, the required marker, plus the color-interactive sheet; the brand theme, danger as the error theme. Fixtures are fictional: a match reminder form (Kick-off reminder: One hour before, Fifteen minutes before, At kick-off; hint We send it as a push notification.; required with error Pick a reminder to continue.; mixed hint The selected matches disagree.; card group Match report format: Short, The score and the scorers. / Full, Every event, with the line-ups.; horizontal group Show matches at: Home, Away, Neutral ground; grid label Remind me one hour before). Framed as a page with 16px padding at 360 and 640. States: a grid of unchecked and checked by rest, hover, focus-visible, active, disabled and readonly (one-option groups); group-none, group-checked, group-support (descriptions and hint), group-option-hover, group-option-pressed, group-option-focus-visible, group-mixed (bulk edit, dashed circles), group-disabled, group-readonly, invalid, invalid-focus-visible, invalid-checked, group-horizontal, card-rest, card-checked, card-hover, card-focus-visible and card-checked-focus-visible. Numbers (light / dark), from shot pixels at scale 2 at 360, brand mint, a: circle 20px with a 2px border and a 10px dot (border-box, fixed in 00072d935); unchecked circle border (surface border) vs page 1.26 / 1.73; checked ring and dot (primary) 1.33 / 13.50; checked hover dot and ring (-hover via color-interactive; the lib hover rule skips a checked radio) 1.37 / 13.06, 1.03 from rest; active 2.24 / 8.01; focus ring and focused border (primary -focus), checked or unchecked, 1.37 / 13.06; card checked edge and ring (primary) 1.33 / 13.50; mixed dashed border (primary) 1.33 / 13.50; invalid circle border (danger) 4.83 / 3.71; disabled checked ring 2.12 / 1.65, disabled label 1.41 / 1.65 (exempt under 1.4.11). Decided rules that arise: Q88 (every radio focus ring in ink, the unchecked one too, since unlike the checkbox it is primary, not the surface text colour; the invalid ring takes the danger ink; the card ring in ink), Q99a (the checked circle border, the focused circle border, the mixed dashed border and the card checked and focus edge take light-dark(ink, primary); the checked dot is a mint fill, so it takes a 1px inset ink edge, an outline at -1px) and Q101 (a checked radio hovers to -active). The ink edge on a mint fill arises, so Q102 arises: b draws the dot edge in both schemes, c keeps dark as today (light-dark(ink, transparent)). The error border is the danger theme, not mint, and passes 3:1, so it is kept. Findings for later: no new lib CSS bug; the radio circle box-sizing bug is fixed (00072d935, measured 40 sheet px = 20px). (1) WCAG 1.4.11: the unchecked circle border is 1.26 / 1.73 vs page, under 3:1, the only edge of an unchecked radio (the same open question as the checkbox box and the switch off track). Not drawn. (2) The required marker takes the error theme primary: 3.71:1 in dark, under 4.5:1; exempted here as in checkbox r1. (3) A checked radio has no hover rule of its own; only color-interactive shifts it to -hover, 1.03 from rest, so hover on a checked radio is invisible in a; Q101 fixes it in b and c. (4) Readonly draws exactly like rest, as with the checkbox. (5) A disabled group dims its options (opacity 0.5 and the disabled label colour, both at once) but not the group label, which keeps 7.81 in light; the same holds for the checkbox group. Later rounds, left out here: the sizes sm and lg, the card with the control at start and the card slots, a coloured (non-brand) radio, the warning state, a disabled option inside an enabled group, a pending (aria-busy) group, long labels that wrap, RTL and the check animation.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...gridStates,
    'group-none': { group: reminderGroup(null) },
    'group-checked': { group: reminderGroup(0) },
    'group-support': {
      group: {
        id: 'support',
        label: 'Kick-off reminder',
        hint: 'We send it as a push notification.',
        options: [
          { label: 'One hour before', description: 'Time to get to the ground.', checked: true },
          { label: 'At kick-off', description: 'Only when the whistle goes.' },
        ],
      },
    },
    'group-option-hover': { group: reminderGroup(0, { force: ['hover'] }) },
    'group-option-pressed': { group: reminderGroup(0, { force: ['hover', 'active'] }) },
    'group-option-focus-visible': { group: reminderGroup(1, { force: ['focus-visible'] }) },
    'group-mixed': { group: reminderGroup(0, { mixed: true, hint: 'The selected matches disagree.' }) },
    'group-disabled': { group: reminderGroup(0, { disabled: true }) },
    'group-readonly': { group: reminderGroup(0, { readonly: true }) },
    invalid: { group: reminderGroup(null, INVALID) },
    'invalid-focus-visible': { group: reminderGroup(null, { ...INVALID, force: ['focus-visible'] }) },
    'invalid-checked': { group: reminderGroup(1, INVALID) },
    'group-horizontal': {
      group: {
        id: 'venue',
        label: 'Show matches at',
        orientation: 'horizontal',
        options: [{ label: 'Home', checked: true }, { label: 'Away' }, { label: 'Neutral ground' }],
      },
    },
    'card-rest': { group: formatGroup(null) },
    'card-checked': { group: formatGroup(0) },
    'card-hover': { group: formatGroup(1, ['hover']) },
    'card-focus-visible': { group: formatGroup(1, ['focus-visible']) },
    'card-checked-focus-visible': { group: formatGroup(0, ['focus-visible']) },
  },
  grid: {
    columns: COLUMNS,
    rows: Object.fromEntries(
      (Object.keys(ROWS) as Row[]).map((row) => [
        row,
        Object.fromEntries(COLUMNS.map((column) => [column, stateOf(row, column)])),
      ]),
    ),
  },
  widths: [360, 640],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${radioGroup(props.group)}</div>`,
      styles: [radioGroupStyles, frame].join('\n'),
    }),
});
