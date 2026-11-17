import { chip, chipRow, chipStyles, ChipMockOptions } from '@ethlete/components/design/chip';
import { definePart, drawing, interactionRows } from '@design-system';
import frame from './chip.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = ChipMockOptions & { interaction?: Interaction; row?: true };

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}" data-can-animate`, interaction && `data-et-force="${interaction}"`]
    .filter(Boolean)
    .join(' ');

const draw = ({ interaction, ...options }: Props) =>
  chip({
    ...options,
    attributes: options.selection ? mark('chip', options.removable ? undefined : interaction) : undefined,
    removeAttributes: options.removable ? mark('remove', interaction) : undefined,
  });

const ROW: ChipMockOptions[] = [
  { label: 'Bundesliga' },
  { label: 'U19', removable: true },
  { label: 'Upcoming', selection: 'checkbox' },
  { label: 'Live', selection: 'checkbox', selected: true },
  { label: 'Finished', selection: 'checkbox', selected: true, readonly: true },
  { label: 'Archived', selection: 'checkbox', disabled: true },
];

const interactive = interactionRows<Props, 'removable' | 'filter' | 'selected' | 'danger', Interaction>(
  {
    removable: { label: 'U19', removable: true },
    filter: { label: 'Upcoming', selection: 'checkbox' },
    selected: { label: 'Live', selection: 'checkbox', selected: true },
    danger: { label: 'Overdue', selection: 'checkbox', selected: true, color: 'danger' },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const disabledRows = {
  disabled: { label: 'Archived', selection: 'checkbox', disabled: true },
  'disabled-selected': { label: 'Archived', selection: 'checkbox', selected: true, disabled: true },
  'disabled-removable': { label: 'U19', removable: true, disabled: true },
} satisfies Record<string, Props>;

export const rows = { ...interactive.states, ...disabledRows };
export const grid = {
  columns: interactive.grid.columns,
  rows: {
    ...interactive.grid.rows,
    disabled: { rest: 'disabled' as const },
    'disabled-selected': { rest: 'disabled-selected' as const },
    'disabled-removable': { rest: 'disabled-removable' as const },
  },
};

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...rows,
    plain: { label: 'Bundesliga' },
    readonly: { label: 'Finished', selection: 'checkbox', selected: true, readonly: true },
    row: { label: '', row: true },
  },
  grid,
  describe: {
    removable: 'The removable U19 chip; check the label and the remove button inside the chip.',
    'removable-hover': 'The removable U19 chip with its remove button hovered; check the round tint behind the x.',
    'removable-active': 'The removable U19 chip with its remove button pressed; check that the tint goes past hover.',
    'removable-focus-visible':
      'The removable U19 chip with its remove button focused; check the focus ring around the x.',
    filter: 'The unselected Upcoming filter chip; check the outline look without a check.',
    'filter-hover': 'The unselected Upcoming filter chip, hovered; check that its tint changes from rest.',
    'filter-active': 'The unselected Upcoming filter chip, pressed; check that it goes a step past hover.',
    'filter-focus-visible':
      'The unselected Upcoming filter chip, with keyboard focus; check the focus ring around the control.',
    selected: 'The selected Live filter chip; check the check and the selected fill.',
    'selected-hover': 'The selected Live filter chip, hovered; check that its tint changes from rest.',
    'selected-active': 'The selected Live filter chip, pressed; check that it goes a step past hover.',
    'selected-focus-visible':
      'The selected Live filter chip, with keyboard focus; check the focus ring around the control.',
    danger: 'The selected Overdue chip in the danger colour; check that the danger fill and label read.',
    'danger-hover': 'The selected Overdue chip in the danger colour, hovered; check that its tint changes from rest.',
    'danger-active': 'The selected Overdue chip in the danger colour, pressed; check that it goes a step past hover.',
    'danger-focus-visible':
      'The selected Overdue chip in the danger colour, with keyboard focus; check the focus ring around the control.',
    disabled: 'The disabled Archived chip; check that the chip fades and shows no pointer state.',
    'disabled-selected': 'The disabled selected Archived chip; check that the check stays but the chip fades.',
    'disabled-removable': 'The disabled removable U19 chip; check that the remove button fades with the chip.',
    plain: 'The plain Bundesliga chip; check the label and the neutral fill.',
    readonly: 'The selected read-only Finished chip; check that it keeps the check but reads as not editable.',
    row: 'Plain, removable, filter, selected, read-only and disabled chips in one row; check that each kind reads apart.',
  },
  widths: [480],
  controls: {
    chip: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
    remove: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
  },
  frame: (body) => `<div class="chip-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: props.row ? chipRow(ROW.map((each) => draw(each))) : draw(props),
      styles: [chipStyles, frame].join('\n'),
    }),
});
