import { iconMarkup } from '@ethlete/components/design/icon';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { tabs, type TabsMockOptions, tabsStyles } from '@ethlete/components/design/tabs';
import { definePart, drawing, interactionRows } from '@design-system';
import edge from './tabs.css?inline';

type TriggerInteraction = 'hover' | 'active' | 'focus-visible';

type Props = TabsMockOptions & { forced?: { tab: number; interaction: TriggerInteraction } };

const TABS = [{ label: 'Overview' }, { label: 'Activity' }, { label: 'Settings' }];
const WITH_DISABLED = [...TABS, { label: 'Billing', disabled: true }];

const icon = (name: string) =>
  iconMarkup(
    SDK_ICONS.find((each) => each.name === name)!,
    'et-tab-group__trigger-icon',
  );
const WITH_ICONS = [
  { label: `${icon('et-grid-2x2')}Overview` },
  { label: `${icon('et-clock')}Activity` },
  { label: `${icon('et-pencil')}Settings` },
];
const ICON_ONLY = [
  { label: icon('et-grid-2x2'), name: 'Overview' },
  { label: icon('et-clock'), name: 'Activity' },
  { label: icon('et-pencil'), name: 'Settings' },
];
const ICON_ONLY_LABELS = Object.fromEntries(ICON_ONLY.map(({ name }, index) => [index, `aria-label="${name}"`]));

const { states, grid } = interactionRows(
  {
    tab: { tabs: TABS, selected: 0 },
    selected: { tabs: TABS, selected: 1 },
  } satisfies Record<string, Props>,
  {
    interactions: ['hover', 'active', 'focus-visible'],
    force: (props: Props, interaction: TriggerInteraction): Props => ({ ...props, forced: { tab: 1, interaction } }),
  },
);

export default definePart({
  note: 'The SDK tab group, drawn by its mock from @ethlete/components/design: the bar with its triggers, the underline of the selected tab and the baseline, in every size, both variants and both orientations.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...states,
    disabled: { tabs: WITH_DISABLED, selected: 0 },
    sm: { tabs: TABS, size: 'sm' },
    lg: { tabs: TABS, size: 'lg' },
    primary: { tabs: TABS, variant: 'primary' },
    icons: { tabs: WITH_ICONS },
    'primary-icons': { tabs: WITH_ICONS, variant: 'primary' },
    'icon-only': { tabs: ICON_ONLY, triggerAttributes: ICON_ONLY_LABELS },
    'primary-icon-only': { tabs: ICON_ONLY, triggerAttributes: ICON_ONLY_LABELS, variant: 'primary' },
    'no-divider': { tabs: TABS, divider: false },
    vertical: { tabs: TABS, orientation: 'vertical' },
    panel: { tabs: TABS, panel: '<p>Three open tasks, two of them due this week.</p>' },
  },
  grid,
  widths: [480],
  controls: {
    tab: { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
  },
  render: ({ forced, ...props }: Props) =>
    drawing({
      body: tabs({
        ...props,
        triggerAttributes: forced
          ? { ...props.triggerAttributes, [forced.tab]: `data-et-force="${forced.interaction}"` }
          : props.triggerAttributes,
      }).replaceAll('role="tab"', 'data-et-control="tab" role="tab"'),
      styles: [tabsStyles, edge].join('\n'),
    }),
});
