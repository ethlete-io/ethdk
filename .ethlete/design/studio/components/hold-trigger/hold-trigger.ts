import { definePart, drawing, html } from '@design-system';

type Props = { content: string; open: boolean; action?: string };

export const holdTrigger = ({ content, open, action = 'emit:openChange' }: Props) =>
  html`<button
    class="flex cursor-pointer border-0 bg-transparent p-0"
    type="button"
    data-et-control="hold"
    data-can-animate="true"
    data-sk-hold
    data-et-action="${action}"
    aria-expanded="${String(open)}"
  >
    ${content}
  </button>`;

const demo = html`<span class="text-ui-sm text-et-surface-muted">Pausiert</span>`;

export default definePart({
  note: 'The bare trigger of the sketch hold status: the host passes its content, usually the paused badge, and a click shows or hides the reason next to it. `aria-expanded` follows the reason; `data-sk-hold` is the hook of the prototype setup.',
  madeBy: ['claude-opus-5-5'],
  widths: [160],
  controls: { hold: { kind: 'button', input: ['pointer', 'keyboard'] } },
  states: {
    closed: { content: demo, open: false },
    open: { content: demo, open: true },
  },
  instant: 'The reason the trigger reveals appears at once.',
  render: (props: Props) => drawing({ body: holdTrigger(props) }),
});
