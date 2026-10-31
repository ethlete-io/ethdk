import {
  checkbox,
  checkboxGroup,
  type CheckboxGroupMockOption,
  type CheckboxGroupMockOptions,
  type CheckboxMockForce,
  type CheckboxMockOptions,
  checkboxGroupStyles,
  checkboxStyles,
} from '@ethlete/components/design/checkbox';
import { definePart, drawing } from '@design-system';
import frame from './checkbox.css?inline';

type Props = { checkbox: CheckboxMockOptions } | { group: CheckboxGroupMockOptions };

const LABEL = 'Send me the match report';

const ROWS = {
  unchecked: {},
  checked: { checked: true },
  indeterminate: { indeterminate: true },
} satisfies Record<string, CheckboxMockOptions>;

const COLUMNS = ['rest', 'hover', 'focus-visible', 'active', 'disabled', 'readonly'] as const;

type Row = keyof typeof ROWS;
type Column = (typeof COLUMNS)[number];

const cellOf = (row: Row, column: Column): CheckboxMockOptions => ({
  ...ROWS[row],
  id: `${row}-${column}`,
  label: LABEL,
  ...(column === 'disabled' ? { disabled: true } : column === 'readonly' ? { readonly: true } : {}),
  ...(column === 'rest' || column === 'disabled' || column === 'readonly'
    ? {}
    : { force: column satisfies CheckboxMockForce }),
});

const stateOf = (row: Row, column: Column) => (column === 'rest' ? row : `${row}-${column}`);

const gridStates = Object.fromEntries(
  (Object.keys(ROWS) as Row[]).flatMap((row) =>
    COLUMNS.map((column) => [stateOf(row, column), { checkbox: cellOf(row, column) }]),
  ),
) as Record<string, Props>;

const CARD: CheckboxMockOptions = {
  id: 'card',
  label: 'Weekly digest',
  description: 'A summary of every match day, each Monday.',
  variant: 'card',
};

const EVENTS = ['Kick-off', 'Goals', 'Half-time', 'Full-time'];

const eventsGroup = (
  checked: number,
  extra: { force?: CheckboxMockForce[]; selectAllForce?: CheckboxMockForce[] } = {},
): CheckboxGroupMockOptions => ({
  id: 'events',
  label: 'Notify me about',
  selectAll: 'All events',
  selectAllForce: extra.selectAllForce,
  options: EVENTS.map((label, index): CheckboxGroupMockOption => ({
    label,
    checked: index < checked,
    force: index === 1 ? extra.force : undefined,
  })),
});

const venueGroup: CheckboxGroupMockOptions = {
  id: 'venue',
  label: 'Show matches',
  orientation: 'horizontal',
  options: [{ label: 'Home', checked: true }, { label: 'Away', checked: true }, { label: 'Neutral ground' }],
};

const render = (props: Props) =>
  'group' in props
    ? checkboxGroup(props.group)
    : checkbox(props.checkbox).replace(
        'class="et-choice-field-label-area',
        'data-et-skip="CLIPPED" class="et-choice-field-label-area',
      );

export default definePart({
  note: "The SDK checkbox (et-checkbox) in flow, first drawing, drawn by the mock from @ethlete/components/design/checkbox with the real markup and CSS: et-checkbox alone and inside et-choice-field (label, et-description, hint, error, required marker), the card variant (et-selection-card), and et-checkbox-group with et-checkbox-group-select-all and et-checkbox-option, plus the color-interactive and focus-ring sheets; the brand theme, danger as the error theme. Fixtures are fictional: a match-report preferences form (Send me the match report, One email per match, no ads., hint We send it after the final whistle.; I accept the terms of use, required, error Accept the terms to continue.; card Weekly digest, A summary of every match day, each Monday.; group Notify me about with All events over Kick-off, Goals, Half-time, Full-time; horizontal group Show matches: Home, Away, Neutral ground). Framed as a page with 16px padding at 360 and 640. States: a grid of unchecked, checked and indeterminate by rest, hover, focus-visible, active, disabled and readonly (all labelled); box-only (checked, no label); support (description and hint); invalid and invalid-focus-visible; card-rest, card-checked, card-hover, card-focus-visible, card-checked-focus-visible; group-unchecked, group-partial (2 of 4, select-all mixed), group-checked, group-option-hover, group-option-pressed (force hover and active), group-option-focus-visible, group-select-all-focus-visible and group-horizontal. Numbers (light / dark), from shot pixels at scale 2 at 360, brand mint, a: unchecked box border (surface border) vs page 1.26 / 1.73, the same for the option and select-all boxes and the card edge; hover border 10.37 / 13.07; checked and indeterminate fill (primary) vs page 1.33 / 13.50, check and dash on it 15.82; checked hover fill (-hover) 1.37 / 13.06, 1.03 from rest; active fill 2.24 / 8.01; focus-visible fill (-focus) 1.37 / 13.06; focus ring on a checked or indeterminate box (primary -focus) 1.37 / 13.06, on an unchecked box (surface text colour) 17.93 / 17.18; card checked edge and card ring (primary) 1.33 / 13.50; option and select-all ring 1.37 / 13.06; invalid box border (danger) 4.83 / 3.71, its focus ring (danger -focus) 6.47 / 2.77; disabled checked fill 2.20 / 1.70, disabled unchecked border 1.12 / 1.27 (exempt under 1.4.11). Decided rules that arise: Q88 (the checked and indeterminate ring, the invalid ring, the card ring, the option and select-all rings in ink; the unchecked ring is the surface text colour, not a primary ring, so it stays), Q99a (the card checked and focus edge and the focused option, select-all and card box borders take light-dark(ink, primary); the checked and indeterminate box, the checked option box and the checked or mixed select-all box are mint fills, so they take a 1px inset ink edge, an outline at -1px as in the table round; on the option and select-all the focus ring owns the outline, so the edge leaves while it shows) and Q101 (a filled checked or indeterminate box hovers to -active). The ink edge on a mint fill arises, so Q102 arises: b draws the edges in both schemes, c keeps dark as today (light-dark(ink, transparent)). The error border is the danger theme, not mint, and passes 3:1, so it is kept. Findings for later: (1) lib bug: .et-checkbox-box, .et-checkbox-option-box and .et-checkbox-group-select-all-box were content-box, so --et-checkbox-size 20px drew a 24px box (48 sheet px at scale 2) in an app without a global border-box reset, and the hint and error started 4px left of the label column. Fixed in the lib (box-sizing: border-box on the three boxes): every box draws 20px (40 sheet px), and the label, description and hint share one column (44 CSS px from the frame edge). (2) WCAG 1.4.11: the unchecked box border is 1.26 / 1.73 vs page, under 3:1; it is the only edge of an unchecked box (the same question as the switch off track, switch r1, open). Not drawn. (3) The required marker takes the error theme primary: 3.71:1 in dark, under 4.5:1; exempted here. (4) Focus-visible lightens the checked fill to -focus (1.37 vs page, light), so a focused checked box reads paler than at rest; the ink ring carries the state in b and c. (5) Readonly draws exactly like rest (no affordance by design); a checked readonly box cannot be told from an editable one. (6) Mock: et-description now has its own stylesheet (description.component.css, f5722a1f5), so the mock's inline copy can import it instead. Later rounds, left out here: the sizes sm and lg, the card with the control at start, a coloured (non-brand) checkbox, the group's bulk-edit mixed state (dashed option boxes, a primary mark that Q99a would reach), a disabled or readonly group, a group with error and the group card variant, long labels that wrap, RTL and the check and uncheck animation.",
  madeBy: ['claude-opus-5-5'],
  states: {
    ...gridStates,
    'box-only': { checkbox: { id: 'box-only', checked: true } },
    support: {
      checkbox: {
        id: 'support',
        label: LABEL,
        description: 'One email per match, no ads.',
        hint: 'We send it after the final whistle.',
      },
    },
    invalid: {
      checkbox: {
        id: 'invalid',
        label: 'I accept the terms of use',
        required: true,
        error: 'Accept the terms to continue.',
        errorColor: 'danger',
      },
    },
    'invalid-focus-visible': {
      checkbox: {
        id: 'invalid-focus-visible',
        label: 'I accept the terms of use',
        required: true,
        error: 'Accept the terms to continue.',
        errorColor: 'danger',
        force: 'focus-visible',
      },
    },
    'card-rest': { checkbox: CARD },
    'card-checked': { checkbox: { ...CARD, checked: true } },
    'card-hover': { checkbox: { ...CARD, force: 'hover' } },
    'card-focus-visible': { checkbox: { ...CARD, force: 'focus-visible' } },
    'card-checked-focus-visible': { checkbox: { ...CARD, checked: true, force: 'focus-visible' } },
    'group-unchecked': { group: eventsGroup(0) },
    'group-partial': { group: eventsGroup(2) },
    'group-checked': { group: eventsGroup(4) },
    'group-option-hover': { group: eventsGroup(0, { force: ['hover'] }) },
    'group-option-pressed': { group: eventsGroup(0, { force: ['hover', 'active'] }) },
    'group-option-focus-visible': { group: eventsGroup(2, { force: ['focus-visible'] }) },
    'group-select-all-focus-visible': { group: eventsGroup(2, { selectAllForce: ['focus-visible'] }) },
    'group-horizontal': { group: venueGroup },
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
  contrast: {
    exceptions: [
      {
        selector: 'et-choice-field[data-error] .et-label-required-marker',
        reason:
          'The required marker takes the error theme primary: 3.71:1 in dark, under 4.5:1. An open point (finding 3), not a decided rule.',
      },
    ],
  },
  widths: [360, 640],
  render: (props: Props) =>
    drawing({
      body: `<div class="t-frame">${render(props)}</div>`,
      styles: [checkboxStyles, checkboxGroupStyles, frame].join('\n'),
    }),
});
