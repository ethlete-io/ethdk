import { anchoredDialog, anchoredDialogStyles } from '@ethlete/components/design/anchored-dialog';
import { checkboxGroup, checkboxGroupStyles } from '@ethlete/components/design/checkbox';
import { control } from '@ethlete/components/design/control';
import { definePart, drawing } from '@design-system';
import button from '@system/components/button';
import edge from './anchored-dialog.css?inline';

type Props = {
  kind?: 'open-points' | 'filter';
  content?: string;
  label?: string;
  placement?: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
  arrow?: boolean;
  anchor?: string;
  modal?: boolean;
};

const POINTS = ['Hover on the tonal button', 'Focus ring in dark mode', 'Disabled outline'];

const openPoints =
  () => `<header class="anchored-dialog-header"><span>Open points</span><span>components/button</span></header>
<ul class="anchored-dialog-list">${POINTS.map((point) => `<li><span>${point}</span></li>`).join('')}</ul>`;

const FILTERS = [
  { label: 'Ready', checked: true },
  { label: 'Open sketch', checked: false },
  { label: 'Has comments', checked: true },
];

const options = () =>
  checkboxGroup({ id: 'filter', options: FILTERS }).replace(/<et-checkbox-option(?=[\s>])/gu, (tag) =>
    control(`${tag}>`, 'option').slice(0, -1),
  );

const filter = (apply: string) => `<header class="anchored-dialog-header"><span>Filter</span></header>
<div class="anchored-dialog-group">${options()}</div>
<footer class="anchored-dialog-footer">${control(apply, 'apply')}</footer>`;

export default definePart({
  note: 'An open popover anchored to its trigger: surface pane, arrow, free content',
  consumerAction: 'the field inside is content the consumer projects',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5', 'design check'],
  states: {
    'open-points': { kind: 'open-points', modal: false },
    filter: { kind: 'filter', placement: 'bottom-start' },
    'no-arrow': { kind: 'filter', placement: 'bottom-start', arrow: false },
    'top-start': { kind: 'open-points', placement: 'top-start', modal: false },
  },
  describe: {
    'open-points':
      'The open points popover under its trigger, end-aligned, with an arrow; check that the arrow points at the trigger and the list reads.',
    filter:
      'The modal filter popover start-aligned with checkboxes and Apply; check the checked boxes and that Apply sits in the footer.',
    'no-arrow': 'The filter popover without its arrow; check that the pane keeps its gap to the trigger.',
    'top-start':
      'The open points popover above its trigger, start-aligned; check that the arrow flips to the bottom edge and points at the trigger.',
  },
  widths: [480],
  controls: {
    option: { kind: 'button', part: 'components/checkbox' },
    apply: { kind: 'button', part: 'components/button' },
  },
  frame: (body, { placement = 'bottom-end' }) =>
    `<div class="anchored-dialog-frame" style="--anchored-dialog-justify:${placement.endsWith('start') ? 'flex-start' : 'flex-end'}"><div data-et-anchor>${body}</div></div>`,
  render: async ({
    kind = 'open-points',
    content,
    label,
    placement = 'bottom-end',
    arrow,
    anchor,
    modal = true,
  }: Props) => {
    const apply = await button.render({ label: 'Apply', variant: 'filled' });
    const pane = content ?? (kind === 'filter' ? filter(apply.body) : openPoints());

    return drawing({
      body: anchoredDialog({
        label: label ?? (kind === 'filter' ? 'Filter' : 'Open points'),
        placement,
        arrow,
        anchor,
        modal,
        content: pane,
      }),
      styles: [anchoredDialogStyles, apply.styles, checkboxGroupStyles, edge].join('\n'),
    });
  },
});
