import { control } from '@ethlete/components/design/control';
import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';

type TargetInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { frame: string; action?: string; interaction?: TargetInteraction };

export const commentTarget = ({ frame, action = 'emit:comment', interaction }: Props) => {
  const markup = control(
    html`<div
      class="absolute inset-0 cursor-crosshair outline-none [transition:var(--transition-state)] bg-(--et-theme-color-primary-solid)/6 hover:bg-(--et-theme-color-primary-solid)/10 active:bg-(--et-theme-color-primary-solid)/14 focus-visible:shadow-[inset_0_0_0_1.5px_var(--focus-ring)]"
      aria-label="Kommentar zu ${frame}"
      role="button"
      tabindex="0"
      data-et-action="${action}"
    ></div>`,
    'target',
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const rows = interactionRows<Props, 'rest', TargetInteraction>(
  { rest: { frame: 'button' } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'The comment-mode layer over a canvas frame: a faint accent wash with a crosshair cursor that covers the frame; a click or Enter starts a comment draft on that frame. Hover deepens the wash a step, pressed a step more, and focus-visible draws an inset ring along the frame edge. The host makes the frame `relative`.',
  madeBy: ['claude-opus-5-5'],
  widths: [320],
  controls: { target: { kind: 'button', input: ['pointer', 'keyboard'] } },
  states: rows.states,
  grid: rows.grid,
  frame: (body) => html`<div class="relative h-30">${body}</div>`,
  describe: {
    rest: 'The comment-mode layer over a frame; check that the faint accent wash covers the whole frame and the cursor is a crosshair.',
    'rest-hover': 'The layer hovered; check that the accent wash deepens a step over the whole frame.',
    'rest-active': 'The layer pressed; check the accent wash a step deeper than hover.',
    'rest-focus-visible':
      'The layer focused by keyboard; check the inset focus ring along the frame edge over the faint wash.',
  },
  render: (props: Props) => drawing({ body: commentTarget(props) }),
});
