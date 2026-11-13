import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { control } from '@ethlete/components/design/control';
import styles from './shell-resize-handle.css?inline';

type ResizeInteraction = Exclude<Interaction, 'disabled'>;

type Props = { width?: number; interaction?: ResizeInteraction };

export const SIDE_WIDTH = { min: 200, rest: 248, dragging: 312, max: 400 };

const LINE =
  '<span class="st-shell-resize-line absolute top-2.5 bottom-2.5 left-0.75 w-0.5 rounded-full group-hover:bg-et-theme/50 group-active:bg-et-theme group-focus-visible:bg-focus-ring"></span>';

export const shellResizeHandleStyles = styles;

export const shellResizeHandle = ({ width = SIDE_WIDTH.rest, interaction }: Props = {}) => {
  const markup = `<div class="st-shell-resize group absolute top-space-3 bottom-space-3 w-2 cursor-col-resize outline-none" role="separator" aria-orientation="vertical" aria-label="Breite der Seitenleiste" aria-valuemin="${SIDE_WIDTH.min}" aria-valuemax="${SIDE_WIDTH.max}" aria-valuenow="${width}" tabindex="0" data-et-action="emit:sideWidthChange">${LINE}</div>`;

  return control(interaction ? forceInteraction(markup, interaction) : markup, 'resize');
};

export default definePart({
  note: 'The resize handle on the right edge of the shell panel: role separator, col-resize cursor, arrow keys; 248 px by default, 200 to 400 px. At rest it draws nothing; hover draws a 2-px accent line at half opacity, dragging (active) the full accent line, focus-visible the line in --focus-ring, each on --transition-state.',
  madeBy: ['claude-opus-5-5'],
  ...interactionRows<Props, 'resize', ResizeInteraction>(
    { resize: {} },
    {
      interactions: ['hover', 'active', 'focus-visible'],
      force: (props, interaction) => ({
        ...props,
        interaction,
        ...(interaction === 'active' ? { width: SIDE_WIDTH.dragging } : {}),
      }),
    },
  ),
  controls: { resize: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles,
  render: (props: Props) =>
    drawing({
      body: html`<div class="relative box-border h-30 w-2 bg-et-surface-bg">${shellResizeHandle(props)}</div>`,
    }),
});
