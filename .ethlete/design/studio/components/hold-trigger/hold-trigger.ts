import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import styles from './hold-trigger.css?inline';

type HoldInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { content: string; open: boolean; reason?: string; action?: string; interaction?: HoldInteraction };

export const holdTriggerStyles = styles;

export const holdTrigger = ({ content, open, reason = '', action = 'emit:openChange', interaction }: Props) => {
  const trigger = html`<button
    class="st-hold -m-space-1 flex cursor-pointer rounded-control-sm border-0 p-space-1 hover:bg-et-surface-interaction/10 active:bg-et-surface-interaction/15"
    type="button"
    data-et-control="hold"
    data-et-surface-interactive
    data-can-animate="true"
    data-sk-hold
    data-et-action="${action}"
    aria-expanded="${String(open)}"
  >
    ${content}
  </button>`;

  return html`<span class="flex min-w-0 items-center gap-space-2">
    ${interaction ? forceInteraction(trigger, interaction) : trigger}
    <span
      class="flex min-w-0 items-center gap-space-2 text-ui-sm text-et-surface-muted whitespace-nowrap"
      data-sk-hold-reason
      ${open ? '' : 'hidden'}
    >
      ${reason}
    </span>
  </span>`;
};

const demo = html`<span class="text-ui-sm text-et-surface-muted">Pausiert</span>`;
const demoReason = html`<span class="font-ui-medium text-et-surface">Wartet auf ADR 0331</span>`;

const { states, grid } = interactionRows<Props, 'closed' | 'open', HoldInteraction>(
  {
    closed: { content: demo, open: false, reason: demoReason },
    open: { content: demo, open: true, reason: demoReason },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'The trigger of the sketch hold status with the reason it reveals: the host passes its content, usually the paused badge, and the reason, and a click shows or hides the reason next to it. The trigger keeps its content in place and draws a faint rounded fill on hover and press and an inset ring on keyboard focus. `aria-expanded` follows the reason; `data-sk-hold` is the hook of the prototype setup.',
  madeBy: ['claude-opus-5-5'],
  widths: [320],
  controls: { hold: { kind: 'button', input: ['pointer', 'keyboard'] } },
  states,
  grid,
  instant: 'The reason the trigger reveals appears at once.',
  describe: {
    closed: 'The trigger around the muted Pausiert text, closed; check that it draws no border, fill or ring at rest.',
    'closed-hover': 'The closed trigger hovered; check the faint rounded fill around the Pausiert text.',
    'closed-active': 'The closed trigger pressed; check the slightly stronger rounded fill.',
    'closed-focus-visible':
      'The closed trigger focused by keyboard; check the inset focus ring around the Pausiert text, not clipped.',
    open: 'The trigger with its reason shown beside it; check that the trigger looks the same as closed and the reason sits on one line with it.',
    'open-hover': 'The open trigger hovered; check that only the trigger takes the fill, not the reason.',
    'open-active': 'The open trigger pressed; check the stronger fill on the trigger only.',
    'open-focus-visible':
      'The open trigger focused by keyboard; check that the ring wraps the trigger and not the reason.',
  },
  render: (props: Props) => drawing({ body: holdTrigger(props), styles }),
});
