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
  consumerAction: 'a form control whose value the consumer binds',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  states: {
    ...rowStates,
    'label-sm': { label: 'Email me updates', size: 'sm', checked: true },
    'label-md': { label: 'Email me updates', size: 'md', checked: true },
    'label-lg': { label: 'Email me updates', size: 'lg', checked: true },
    'card-off': { label: 'Weekly digest', variant: 'card' },
    'card-on': { label: 'Weekly digest', variant: 'card', checked: true },
  },
  describe: {
    off: 'The switch off; check that the off track has a visible edge and the handle sits at the start.',
    'off-hover': 'The off switch hovered; check that the track shows the hover look.',
    'off-focus-visible': 'The off switch focused by keyboard; check that the focus ring wraps the track.',
    'off-active': 'The off switch pressed; check the press look on the track and handle.',
    'off-disabled': 'The off switch disabled; check that track and handle fade.',
    on: 'The switch on; check that the track fills with the brand color and the handle sits at the end.',
    'on-hover': 'The on switch hovered; check that the filled track shifts visibly.',
    'on-focus-visible': 'The on switch focused by keyboard; check that the focus ring wraps the filled track.',
    'on-active': 'The on switch pressed; check the press look on the filled track.',
    'on-disabled': 'The on switch disabled; check that it fades but still reads as on.',
    indeterminate: 'The switch indeterminate; check that the handle sits in the middle.',
    'indeterminate-hover': 'The indeterminate switch hovered; check the hover look on the track.',
    'indeterminate-focus-visible': 'The indeterminate switch focused by keyboard; check that the focus ring shows.',
    'indeterminate-active': 'The indeterminate switch pressed; check the press look on the track.',
    'indeterminate-disabled': 'The indeterminate switch disabled; check that it fades and the handle stays centered.',
    'label-sm': 'An on switch with a label at size sm; check that switch and label shrink and stay aligned.',
    'label-md': 'An on switch with a label at size md; check that the label centers on the switch.',
    'label-lg': 'An on switch with a label at size lg; check that switch and label grow and stay aligned.',
    'card-off': 'The Weekly digest card with the switch off; check the card border and the switch inside.',
    'card-on': 'The Weekly digest card with the switch on; check that the card takes the checked look.',
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
        attributes: [
          options.attributes,
          options.label === undefined && 'data-et-control="switch"',
          interaction && `data-et-force="${interaction}"`,
        ]
          .filter(Boolean)
          .join(' '),
      })
        .replace('<et-choice-field ', '<et-choice-field data-et-control="switch" ')
        .replace('class="et-choice-field-label-area', 'data-et-skip="CLIPPED" class="et-choice-field-label-area'),
      styles: [switchStyles, offTrack].join('\n'),
    }),
});
