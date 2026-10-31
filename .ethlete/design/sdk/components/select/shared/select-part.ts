import { formField } from '@ethlete/components/design/form-field';
import { select } from '@ethlete/components/design/select';
import { interactionRows } from '@design-system';

type FieldInteraction = 'hover' | 'active' | 'focus-visible';

export type SelectProps = {
  label?: string;
  options?: { value: string; label: string }[];
  value?: string;
  open?: boolean;
  active?: string;
  pointerActive?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'lg';
  interaction?: FieldInteraction;
};

const OPTIONS = [
  { value: 'drafts', label: 'Drafts' },
  { value: 'review', label: 'In review' },
  { value: 'merged', label: 'Merged' },
];

const markControl = (markup: string, { interaction, pointerActive }: SelectProps) => {
  const frame = ['data-et-control-part', interaction && `data-et-force="${interaction}"`].filter(Boolean);
  const marked = markup
    .replace('<et-form-field ', '<et-form-field data-et-control="select" ')
    .replace('<div class="et-form-field-control-frame"', `<div class="et-form-field-control-frame" ${frame.join(' ')}`)
    .replace('class="et-select-trigger"', 'data-et-control-part class="et-select-trigger"')
    .replace('<et-select-panel ', '<et-select-panel data-et-surface="select.open" ');

  return pointerActive
    ? marked.replace('data-active-source="keyboard"', 'data-active-source="pointer" data-et-force="hover"')
    : marked;
};

const interactive = interactionRows<SelectProps, 'placeholder' | 'selected', FieldInteraction>(
  {
    placeholder: {},
    selected: { value: 'review' },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const SIZES = ['sm', 'lg'] as const;

export const states = interactive.states;
export const grid = {
  columns: interactive.grid.columns,
  rows: {
    ...interactive.grid.rows,
    ...Object.fromEntries(SIZES.map((size) => [`size ${size}`, { rest: `size-${size}` as const }])),
  },
};

export const moreStates = {
  disabled: { value: 'review', disabled: true },
  open: { value: 'review', open: true, active: 'merged' },
  'open-option-hover': { value: 'review', open: true, active: 'drafts', pointerActive: true },
  'size-sm': { value: 'review', size: 'sm' },
  'size-lg': { value: 'review', size: 'lg' },
} satisfies Record<string, SelectProps>;

export const selectBody = (props: SelectProps) =>
  markControl(
    formField({
      id: 'status',
      label: props.label ?? 'Status',
      errorColor: 'danger',
      open: props.open,
      disabled: props.disabled,
      size: props.size,
      control: select({
        options: props.options ?? OPTIONS,
        value: props.value,
        active: props.active,
        placeholder: 'Pick a status',
      }),
    }),
    props,
  );
