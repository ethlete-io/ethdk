import { anchoredDialog, anchoredDialogStyles } from '@ethlete/components/design/anchored-dialog';
import { definePart, drawing } from '@design-system';
import button from '@system/components/button';
import edge from './anchored-dialog.css?inline';

type Props = {
  kind?: 'open-points' | 'filter';
  content?: string;
  label?: string;
  placement?: 'bottom-end' | 'bottom-start' | 'top-end' | 'top-start';
  arrow?: boolean;
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

const filter = (apply: string) => `<header class="anchored-dialog-header"><span>Filter</span></header>
<ul class="anchored-dialog-list">${FILTERS.map(
  ({ label, checked }) =>
    `<li><label><input type="checkbox" data-et-control="option"${checked ? ' checked' : ''} />${label}</label></li>`,
).join('')}</ul>
<footer class="anchored-dialog-footer">${apply}</footer>`;

export default definePart({
  note: 'An open popover anchored to its trigger: surface pane, arrow, free content',
  madeBy: ['claude-sonnet-5-5'],
  states: {
    'open-points': { kind: 'open-points', modal: false },
    filter: { kind: 'filter', placement: 'bottom-start' },
    'no-arrow': { kind: 'filter', placement: 'bottom-start', arrow: false },
    'top-start': { kind: 'open-points', placement: 'top-start', modal: false },
  },
  widths: [480],
  controls: {
    option: { kind: 'row', input: ['pointer', 'keyboard'] },
    apply: { kind: 'button', part: 'components/button' },
  },
  render: async ({ kind = 'open-points', content, label, placement = 'bottom-end', arrow, modal = true }: Props) => {
    const apply = await button.render({ label: 'Apply', variant: 'filled' });
    const pane = content ?? (kind === 'filter' ? filter(apply.body) : openPoints());

    return drawing({
      body: `<div class="anchored-dialog-frame" style="--anchored-dialog-justify:${placement.endsWith('start') ? 'flex-start' : 'flex-end'}"><div data-et-anchor>${anchoredDialog(
        {
          label: label ?? (kind === 'filter' ? 'Filter' : 'Open points'),
          placement,
          arrow,
          modal,
          content: pane,
        },
      )}</div></div>`,
      styles: [anchoredDialogStyles, apply.styles, edge].join('\n'),
    });
  },
});
