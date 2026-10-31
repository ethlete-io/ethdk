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
  grid,
  widths: [280],
  controls: {
    option: { kind: 'row', input: ['pointer', 'keyboard'], disabled: true },
  },
  render: (props: Props) =>
    drawing({
      body: `<div class="select-panel-frame">${props.panel ? groupedPanel(props) : singleOption(props)}</div>`,
      styles: [selectStyles, styles].join('\n'),
    }),
});
