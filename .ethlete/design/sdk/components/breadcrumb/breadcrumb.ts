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
  describe: {
    default:
      'Home, Competitions and the current Regionalliga Nordost; check the separators and the current page in plain text.',
    'link-hover': 'Competitions hovered; check the hover look of the link.',
    'link-active': 'Competitions pressed; check that the press differs from hover.',
    'link-focus-visible': 'Competitions with keyboard focus; check the focus ring around the link.',
    'current-page': 'The current page crumb hovered; check that it shows no link hover.',
    long: 'A six-crumb trail with the middle four folded into the overflow button; check that Home, the button and the match fit one line.',
    'overflow-hover': 'The overflow button hovered; check its hover tint.',
    'overflow-active': 'The overflow button pressed; check that the tint goes past hover.',
    'overflow-focus-visible': 'The overflow button with keyboard focus; check the focus ring around it.',
    'overflow-open':
      'The overflow panel open with the four hidden crumbs; check that it sits under the button and lists them in order.',
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
