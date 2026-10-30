import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import styles from './disclosure.css?inline';

type DisclosureInteraction = 'hover' | 'active' | 'focus-visible';

export type Props = {
  label: string;
  body: string;
  open: boolean;
  size?: 'sm' | 'xs';
  interaction?: DisclosureInteraction;
};

const CHEVRON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

export const disclosure = ({ label, body, open, size = 'sm', interaction }: Props) => {
  const toggle = html`<button
    class="st-disclosure"
    type="button"
    data-et-control="toggle"
    data-size="${size}"
    aria-expanded="${open}"
  >
    ${CHEVRON}<span>${label}</span>
  </button>`;
  const line = interaction ? forceInteraction(toggle, interaction) : toggle;

  return open ? line + html`<div class="st-disclosure-panel" data-et-surface="toggle.body">${body}</div>` : line;
};

const demo: Omit<Props, 'open'> = {
  label: '2 states of pages/inbox without visible change',
  body: html`<ul class="st-disclosure-body">
    <li><span>pages/inbox</span><span>all</span></li>
    <li><span>pages/inbox</span><span>none</span></li>
  </ul>`,
};

export const { states, grid } = interactionRows<Props, 'rest' | 'open' | 'xs', DisclosureInteraction>(
  { rest: { ...demo, open: false }, open: { ...demo, open: true }, xs: { ...demo, open: false, size: 'xs' } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'The disclosure toggle of the merge page: a muted chevron and label, text darkens on hover, focus-visible draws an inset ring, and the chevron turns 90 degrees when open.',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5'],
  widths: [320],
  states,
  grid,
  controls: { toggle: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } } },
  render: (props: Props) => drawing({ body: disclosure(props), styles }),
});
