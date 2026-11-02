import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';

type ResetInteraction = Exclude<Interaction, 'disabled'>;

type Props = { percent: number; interaction?: ResetInteraction };

export const zoomResetStyles = buttonStyles;

export const zoomReset = ({ percent, interaction }: Props) => {
  const markup = button({
    label: `${percent} %`,
    variant: 'transparent',
    color: 'surface',
    size: 'sm',
    class: 'tabular-nums',
  }).replace(
    /^<button /,
    '<button data-et-control="reset" data-et-action="emit:zoomReset" aria-label="Auf 100 % zoomen" data-can-animate ',
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'The zoom percent in the canvas zoom chip; a click resets the zoom to 100 %. SDK transparent sm button with tabular digits, so the chip keeps its width from 25 % to 250 %. Each row draws it at rest, hovered, pressed and focused.',
  madeBy: ['claude-opus-5-5'],
  ...interactionRows<Props, 'reset' | 'wide', ResetInteraction>(
    { reset: { percent: 100 }, wide: { percent: 250 } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { reset: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles: buttonStyles,
  render: (props: Props) =>
    drawing({
      body: html`<div class="inline-flex p-space-2 text-et-surface font-ui">${zoomReset(props)}</div>`,
    }),
});
