import {
  breadcrumb,
  BreadcrumbMockCrumb,
  breadcrumbOverflowPanel,
  breadcrumbStyles,
} from '@ethlete/components/design/breadcrumb';
import { definePart, drawing } from '@design-system';
import frame from './breadcrumb.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = {
  long?: boolean;
  open?: boolean;
  link?: Interaction;
  current?: Interaction;
  overflow?: Interaction;
};

const mark = (control: string, interaction?: Interaction) =>
  [`data-et-control="${control}"`, interaction && `data-et-force="${interaction}"`].filter(Boolean).join(' ');

const shortTrail = (props: Props): BreadcrumbMockCrumb[] => [
  { label: 'Home', href: '#' },
  { label: 'Competitions', href: '#', attributes: mark('link', props.link) },
  { label: 'Regionalliga Nordost', attributes: mark('current', props.current) },
];

const longTrail = (props: Props): BreadcrumbMockCrumb[] => [
  { label: 'Home', href: '#' },
  { label: 'Competitions', href: '#' },
  { label: 'Regionalliga Nordost', href: '#' },
  { label: 'Season 2026/27', href: '#' },
  { label: 'Matchday 14', href: '#' },
  { label: 'Chemie Leipzig vs. Lokomotive Leipzig', attributes: mark('current', props.current) },
];

const hiddenCrumbs = [1, 2, 3, 4];

const longMarkup = (props: Props) => {
  const trail = longTrail(props);
  const panel = props.open
    ? breadcrumbOverflowPanel(hiddenCrumbs.map((index) => trail[index]!)).replace(
        'class="et-overlay ',
        'data-et-surface="overflow.body" class="et-overlay ',
      )
    : '';

  return `<div class="breadcrumb-overflow-stage">${panel}${breadcrumb({
    crumbs: trail,
    collapsed: hiddenCrumbs,
    overflowAttributes: mark('overflow', props.overflow),
  })}</div>`;
};

export default definePart({
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    'link-hover': { link: 'hover' },
    'link-active': { link: 'active' },
    'link-focus-visible': { link: 'focus-visible' },
    'current-page': { current: 'hover' },
    long: { long: true },
    'overflow-hover': { long: true, overflow: 'hover' },
    'overflow-active': { long: true, overflow: 'active' },
    'overflow-focus-visible': { long: true, overflow: 'focus-visible' },
    'overflow-open': { long: true, open: true },
  },
  widths: [480],
  controls: {
    link: { kind: 'button', input: ['pointer', 'keyboard'] },
    overflow: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'overflow-open' } },
  },
  frame: (body) => `<div class="breadcrumb-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: props.long ? longMarkup(props) : breadcrumb({ crumbs: shortTrail(props) }),
      styles: [breadcrumbStyles, frame].join('\n'),
    }),
});
