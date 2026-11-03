import { definePart, drawing, html } from '@design-system';

type Props = { frame: string; action?: string };

export const commentTarget = ({ frame, action = 'emit:comment' }: Props) =>
  html`<div
    class="absolute inset-0 cursor-crosshair bg-(--et-theme-color-primary-solid)/6"
    title="Kommentar zu ${frame}"
    role="button"
    tabindex="0"
    data-et-control="target"
    data-et-action="${action}"
  ></div>`;

export default definePart({
  note: 'The comment-mode layer over a canvas frame: a faint accent wash with a crosshair cursor that covers the frame; a click or Enter starts a comment draft on that frame. The host makes the frame `relative`.',
  madeBy: ['claude-opus-5-5'],
  widths: [320],
  controls: { target: { kind: 'button', input: ['pointer', 'keyboard'] } },
  states: { rest: { frame: 'button' } },
  frame: (body) => html`<div class="relative h-30">${body}</div>`,
  render: (props: Props) => drawing({ body: commentTarget(props) }),
});
