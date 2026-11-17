import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import { icon } from '@system/foundations/icons';
import styles from './disclosure.css?inline';

type DisclosureInteraction = 'hover' | 'active' | 'focus-visible';

export type Props = {
  label: string;
  body: string;
  open: boolean;
  size?: 'sm' | 'xs';
  hug?: boolean;
  interaction?: DisclosureInteraction;
  action?: string;
};

const CHEVRON = icon('chevron-right', { size: 14, cls: 'flex-none' });

export const disclosureBodyClass =
  'st-disclosure-body flex flex-col gap-space-1 m-0 text-et-surface-muted text-(length:--text-xs) *:flex *:gap-space-2';

export const disclosure = ({ label, body, open, size = 'sm', hug = false, interaction, action }: Props) => {
  const toggle = html`<button
    class="st-disclosure flex ${hug ? '' : 'w-full'} gap-space-2 px-space-2 py-space-1 border-0 text-et-surface-muted hover:text-et-surface active:bg-et-surface-interaction/15 active:text-et-surface active:rounded-control-sm focus-visible:text-et-surface focus-visible:rounded-control-sm cursor-pointer ${size === 'xs' ? 'items-start text-start text-(length:--text-xs)' : 'items-center text-(length:--text-sm)'}"
    type="button"
    data-et-surface-interactive
    data-et-control="toggle"
    data-et-action="${action ?? (size === 'xs' ? 'emit:openChange' : open ? 'rest' : 'open')}"
    aria-expanded="${open}"
  >
    ${CHEVRON}<span>${label}</span>
  </button>`;
  const line = interaction ? forceInteraction(toggle, interaction) : toggle;

  return open ? line + html`<div class="st-disclosure-panel" data-et-surface="toggle.body">${body}</div>` : line;
};

const demo: Omit<Props, 'open'> = {
  label: '2 states of pages/inbox without visible change',
  body: html`<ul class="${disclosureBodyClass}">
    <li><span>pages/inbox</span><span>all</span></li>
    <li><span>pages/inbox</span><span>none</span></li>
  </ul>`,
};

export const { states, grid } = interactionRows<Props, 'rest' | 'open' | 'xs', DisclosureInteraction>(
  { rest: { ...demo, open: false }, open: { ...demo, open: true }, xs: { ...demo, open: false, size: 'xs' } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/disclosure/disclosure.component.ts',
  note: 'The disclosure toggle of the merge page: a muted chevron and label, text darkens on hover, focus-visible draws an inset ring, and the chevron turns 90 degrees when open.',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5'],
  widths: [320],
  states,
  grid,
  controls: { toggle: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } } },
  describe: {
    rest: 'The closed disclosure with a muted chevron and label; check that the chevron points right and the label sits level with it.',
    'rest-hover':
      'The closed toggle hovered; check that the label and chevron darken to the surface text colour without a fill.',
    'rest-active': 'The closed toggle pressed; check the faint rounded press fill behind it and the darkened label.',
    'rest-focus-visible':
      'The closed toggle focused by keyboard; check the inset focus ring around the whole row and the darkened label.',
    open: 'The open disclosure with its list of two states; check that the chevron turns 90 degrees and the list sits under the label.',
    'open-hover': 'The open toggle hovered; check that the label darkens and the list below keeps its muted text.',
    'open-active': 'The open toggle pressed; check the rounded press fill on the toggle row only, not over the list.',
    'open-focus-visible':
      'The open toggle focused by keyboard; check that the inset ring wraps the toggle row and not the list.',
    xs: 'The closed disclosure at the xs size; check the smaller text and that the chevron stays level with the label.',
    'xs-hover': 'The xs toggle hovered; check that the label darkens like the sm one does.',
    'xs-active': 'The xs toggle pressed; check the rounded press fill around the smaller row.',
    'xs-focus-visible':
      'The xs toggle focused by keyboard; check that the inset ring fits the smaller row and is not clipped.',
  },
  render: (props: Props) => drawing({ body: disclosure(props), styles }),
});
