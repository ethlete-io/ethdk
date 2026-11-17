import { definePart, drawing, html } from '@design-system';

type Props = { content: string; open: boolean; reason?: string; action?: string };

export const holdTrigger = ({ content, open, reason = '', action = 'emit:openChange' }: Props) =>
  html`<span class="flex min-w-0 items-center gap-space-2">
    <button
      class="flex cursor-pointer border-0 bg-transparent p-0"
      type="button"
      data-et-control="hold"
      data-can-animate="true"
      data-sk-hold
      data-et-action="${action}"
      aria-expanded="${String(open)}"
    >
      ${content}
    </button>
    <span
      class="flex min-w-0 items-center gap-space-2 text-ui-sm text-et-surface-muted whitespace-nowrap"
      data-sk-hold-reason
      ${open ? '' : 'hidden'}
    >
      ${reason}
    </span>
  </span>`;

const demo = html`<span class="text-ui-sm text-et-surface-muted">Pausiert</span>`;
const demoReason = html`<span class="font-ui-medium text-et-surface">Wartet auf ADR 0331</span>`;

export default definePart({
  note: 'The trigger of the sketch hold status with the reason it reveals: the host passes its content, usually the paused badge, and the reason, and a click shows or hides the reason next to it. `aria-expanded` follows the reason; `data-sk-hold` is the hook of the prototype setup.',
  madeBy: ['claude-opus-5-5'],
  widths: [320],
  controls: { hold: { kind: 'button', input: ['pointer', 'keyboard'] } },
  states: {
    closed: { content: demo, open: false, reason: demoReason },
    open: { content: demo, open: true, reason: demoReason },
  },
  instant: 'The reason the trigger reveals appears at once.',
  describe: {
    closed:
      'The bare trigger around the muted Pausiert text, closed; check that it draws no border, fill or padding of its own.',
    open: 'The trigger with its reason shown beside it; check that the trigger looks the same as closed and the reason sits on one line with it.',
  },
  render: (props: Props) => drawing({ body: holdTrigger(props) }),
});
