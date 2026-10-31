import { buttonStyles } from '@ethlete/components/design/button';
import { control } from '@ethlete/components/design/control';
import { definePart, drawing, forceInteraction, html, interactionRows } from '@design-system';
import styles from './canvas-viewport.css?inline';

type Props = { interaction?: 'focus-visible' };

export const canvasViewportStyles = buttonStyles + styles;

export const canvasViewport = ({
  body,
  class: extra = '',
  attrs = '',
  interaction,
}: {
  body: string;
  class?: string;
  attrs?: string;
  interaction?: Props['interaction'];
}) => {
  const markup = control(
    html`<div
      class="st-canvas-viewport et-focus-ring cursor-grab touch-none active:cursor-grabbing ${extra}"
      ${attrs}
      tabindex="0"
      aria-label="Design Canvas"
    >
      ${body}
    </div>`,
    'canvas',
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const world = html`<div class="absolute top-space-4 left-space-4 flex gap-space-4">
  <div class="h-40 w-56 rounded-control-md bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]"></div>
  <div class="h-40 w-56 rounded-control-md bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]"></div>
</div>`;

export default definePart({
  note: 'The pannable design canvas of the Sketches page: arrow keys pan it, so it takes keyboard focus. Focus-visible fades in four 24px corner marks in the SDK focus ring colour inside the viewport corners instead of a closed ring: quiet on a canvas that fills the page, and never clips at the page edge.',
  ...interactionRows<Props, 'canvas', 'focus-visible'>(
    { canvas: {} },
    { interactions: ['focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { canvas: { kind: 'field', input: ['keyboard'] } },
  styles: canvasViewportStyles,
  render: ({ interaction }: Props) =>
    drawing({
      body: html`<div class="p-space-3 bg-et-surface-bg">
        ${canvasViewport({ body: world, class: 'relative h-56 w-128 overflow-hidden', interaction })}
      </div>`,
    }),
});
