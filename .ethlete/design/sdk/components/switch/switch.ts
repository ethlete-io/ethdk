import { switchControl, type SwitchMockOptions, switchStyles } from '@ethlete/components/design/switch';
import { definePart, drawing } from '@design-system';
import offTrack from './switch.css?inline';

type Interaction = 'hover' | 'focus-visible' | 'active';

type Props = SwitchMockOptions & { interaction?: Interaction };

const ROWS = {
  off: {},
  on: { checked: true },
  indeterminate: { indeterminate: true },
} satisfies Record<string, Props>;

const INTERACTIONS = ['hover', 'focus-visible', 'active'] as const;

type Row = keyof typeof ROWS;

const rowStates = Object.fromEntries(
  Object.entries(ROWS).flatMap(([row, props]) => [
    [row, props],
    ...INTERACTIONS.map((interaction) => [`${row}-${interaction}`, { ...props, interaction }]),
    [`${row}-disabled`, { ...props, disabled: true }],
  ]),
) as Record<Row | `${Row}-${Interaction | 'disabled'}`, Props>;

const columns = ['rest', ...INTERACTIONS, 'disabled'] as const;

export default definePart({
  note: 'The SDK switch, drawn by its mock from @ethlete/components/design: alone off, on and indeterminate in every interaction, and inside an et-choice-field with a label in each size and as a card. The label area skips CLIPPED: its 1.2 line height rounds the 12 and 16 px line box down by under a pixel, with no glyph cut.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...rowStates,
    'label-sm': { label: 'Email me updates', size: 'sm', checked: true },
    'label-md': { label: 'Email me updates', size: 'md', checked: true },
    'label-lg': { label: 'Email me updates', size: 'lg', checked: true },
    'card-off': { label: 'Weekly digest', variant: 'card' },
    'card-on': { label: 'Weekly digest', variant: 'card', checked: true },
  },
  grid: {
    columns,
    rows: Object.fromEntries(
      Object.keys(ROWS).map((row) => [
        row,
        Object.fromEntries(columns.map((column) => [column, column === 'rest' ? row : `${row}-${column}`])),
      ]),
    ) as Record<Row, Record<(typeof columns)[number], keyof typeof rowStates>>,
  },
  controls: {
    switch: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
  },
  render: ({ interaction, ...options }: Props) =>
    drawing({
      body: switchControl({
        ...options,
        color: 'brand',
        attributes: ['data-et-control="switch"', interaction && `data-et-force="${interaction}"`]
          .filter(Boolean)
          .join(' '),
      }).replace('class="et-choice-field-label-area', 'data-et-skip="CLIPPED" class="et-choice-field-label-area'),
      styles: [switchStyles, offTrack].join('\n'),
    }),
});
