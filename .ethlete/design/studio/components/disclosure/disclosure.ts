import { definePart, drawing, forceInteraction, html } from '@design-system';
import styles from './disclosure.css?inline';

export type DisclosureState = 'rest' | 'hover' | 'focus-visible' | 'open';

export type Props = { label: string; body: string; state: DisclosureState };

const CHEVRON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

export const disclosure = ({ label, body, state }: Props) => {
  const toggle = html`<button
    class="st-disclosure"
    type="button"
    data-et-control="toggle"
    aria-expanded="${state === 'open'}"
  >
    ${CHEVRON}<span>${label}</span>
  </button>`;
  const line = state === 'hover' || state === 'focus-visible' ? forceInteraction(toggle, state) : toggle;

  return state === 'open' ? line + html`<div data-et-surface="toggle.body">${body}</div>` : line;
};

const demo = {
  label: '2 states of pages/inbox without visible change',
  body: html`<ul class="st-disclosure-body">
    <li><span>pages/inbox</span><span>all</span></li>
    <li><span>pages/inbox</span><span>none</span></li>
  </ul>`,
};

export const states = {
  rest: { ...demo, state: 'rest' },
  hover: { ...demo, state: 'hover' },
  'focus-visible': { ...demo, state: 'focus-visible' },
  open: { ...demo, state: 'open' },
} satisfies Record<string, Props>;

export default definePart({
  note: 'The disclosure toggle of the merge page: a muted chevron and label, text darkens on hover, focus-visible draws an inset ring, and the chevron turns 90 degrees when open.',
  madeBy: ['claude-sonnet-5-5'],
  widths: [320],
  states,
  controls: { toggle: { kind: 'disclosure', input: ['pointer', 'keyboard'], surfaces: { body: 'open' } } },
  render: (props: Props) => drawing({ body: disclosure(props), styles }),
});
