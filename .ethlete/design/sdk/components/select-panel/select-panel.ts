import {
  selectAllOption,
  SelectMockActiveSource,
  SelectMockOption,
  selectOption,
  selectOptionGroup,
  selectPanel,
  selectStyles,
} from '@ethlete/components/design/select';
import { definePart, drawing, interactionRows } from '@design-system';
import styles from './select-panel.css?inline';

type OptionInteraction = 'hover' | 'active' | 'focus-visible';

type Props = {
  selected?: boolean;
  disabled?: boolean;
  interaction?: OptionInteraction;
  allSelected?: boolean;
  panel?: boolean;
};

const GROUPS: { label: string; options: SelectMockOption[] }[] = [
  {
    label: 'Open',
    options: [
      { value: 'drafts', label: 'Drafts' },
      { value: 'review', label: 'In review' },
    ],
  },
  {
    label: 'Closed',
    options: [
      { value: 'merged', label: 'Merged' },
      { value: 'archived', label: 'Archived', disabled: true },
    ],
  },
];

const SOURCES: Record<OptionInteraction, SelectMockActiveSource> = {
  hover: 'pointer',
  active: 'pointer',
  'focus-visible': 'keyboard',
};

const markOption = (markup: string, interaction?: OptionInteraction) =>
  markup.replace(
    /<(et-select-option|et-select-all-option) /,
    `<$1 data-et-control="option"${interaction ? ` data-et-force="${interaction}"` : ''} `,
  );

const singleOption = ({ selected, disabled, interaction }: Props) =>
  selectPanel({
    id: 'single',
    color: 'brand',
    content: markOption(
      selectOption(
        { value: 'review', label: 'In review', disabled },
        { id: 'single-option', selected, active: interaction && !disabled ? SOURCES[interaction] : undefined },
      ),
      interaction,
    ),
  });

const groupedPanel = ({ allSelected }: Props) => {
  const isSelected = (option: SelectMockOption) => (allSelected ? !option.disabled : option.value === 'review');
  const groups = GROUPS.map((group, groupIndex) =>
    selectOptionGroup({
      labelId: `status-group-${groupIndex}`,
      label: group.label,
      content: group.options
        .map((option) =>
          markOption(
            selectOption(option, {
              id: `status-option-${option.value}`,
              selected: isSelected(option),
              active: option.value === 'merged' ? 'keyboard' : undefined,
            }),
          ),
        )
        .join(''),
    }),
  ).join('');

  return selectPanel({
    id: 'status',
    color: 'brand',
    multiple: true,
    content:
      markOption(selectAllOption({ id: 'status-all', label: 'Select all', checked: allSelected || 'mixed' })) + groups,
  });
};

const { states, grid } = interactionRows(
  {
    option: {},
    selected: { selected: true },
    disabled: { disabled: true },
  } satisfies Record<string, Props>,
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props: Props, interaction: OptionInteraction): Props => ({ ...props, interaction }),
  },
);

export default definePart({
  note: 'The SDK select option and open panel, shared by select, page-size-select and phone-input, drawn by the mocks from @ethlete/components/design.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...states,
    'panel-grouped': { panel: true },
    'panel-all-selected': { panel: true, allSelected: true },
  },
  describe: {
    option: 'One unselected In review option in an open panel; check its padding and the empty check slot.',
    'option-hover': 'The option hovered; check that the row takes the pointer highlight.',
    'option-active': 'The option pressed; check that the pressed tint is deeper than hover.',
    'option-focus-visible': 'The option active by keyboard; check that the row shows the keyboard focus look.',
    selected: 'One selected In review option; check that the check mark and selected color show.',
    'selected-hover': 'The selected option hovered; check that the highlight shows and the check stays visible.',
    'selected-active': 'The selected option pressed; check that the press look keeps the check readable.',
    'selected-focus-visible': 'The selected option active by keyboard; check that focus shows with the check mark.',
    'disabled-hover': 'The disabled option under the pointer; check that it gives no highlight.',
    'disabled-active': 'The disabled option pressed; check that it gives no press look.',
    'disabled-focus-visible': 'The disabled option reached by keyboard; check that it shows no focus look.',
    disabled: 'One disabled In review option; check that the label fades and no highlight shows.',
    'panel-grouped':
      'A multi-select panel with Select all and two groups; check the group labels, the mixed Select all and Merged active.',
    'panel-all-selected':
      'The grouped panel with all selected; check that Select all is checked and disabled Archived stays off.',
  },
  grid,
  widths: [280],
  controls: {
    option: { kind: 'row', input: ['pointer', 'keyboard'], disabled: true },
  },
  frame: (body) => `<div class="select-panel-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: props.panel ? groupedPanel(props) : singleOption(props),
      styles: [selectStyles, styles].join('\n'),
    }),
});
