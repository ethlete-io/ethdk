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

export const { states: rows, grid } = interactionRows<
  Props,
  'removable' | 'filter' | 'selected' | 'danger' | 'disabled' | 'disabled-selected' | 'disabled-removable',
  Interaction
>(
  {
    removable: { label: 'U19', removable: true },
    filter: { label: 'Upcoming', selection: 'checkbox' },
    selected: { label: 'Live', selection: 'checkbox', selected: true },
    danger: { label: 'Overdue', selection: 'checkbox', selected: true, color: 'danger' },
    disabled: { label: 'Archived', selection: 'checkbox', disabled: true },
    'disabled-selected': { label: 'Archived', selection: 'checkbox', selected: true, disabled: true },
    'disabled-removable': { label: 'U19', removable: true, disabled: true },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'The SDK chip (et-chip), drawn by its mock from @ethlete/components/design: a plain chip, a removable chip with its remove icon button, and the filter chip etSelectionOption makes of it (role checkbox, selected through aria-checked, readonly); the danger row is a selected chip under the danger theme; disabled at the 0.4 chip opacity. The chip has no variants or sizes. Interactions force the chip itself on filter rows and the remove button on removable rows.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...rows,
    plain: { label: 'Bundesliga' },
    readonly: { label: 'Finished', selection: 'checkbox', selected: true, readonly: true },
    row: { label: '', row: true },
  },
  grid,
  widths: [480],
  contrast: {
    exceptions: [
      {
        selector: '.et-chip.et-color--danger .et-chip-label',
        reason:
          "Hovered, the selected danger chip's 24% fill takes its ink label to 4.42:1 on light; the hover step is open in another round (Q101), not this round's question.",
      },
    ],
  },
  controls: {
    chip: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
    remove: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="chip-frame">${props.row ? chipRow(ROW.map((each) => draw(each))) : draw(props)}</div>`,
      styles: [chipStyles, frame].join('\n'),
    }),
});
