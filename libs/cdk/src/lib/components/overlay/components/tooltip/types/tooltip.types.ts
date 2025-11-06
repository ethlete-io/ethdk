import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';

export interface TooltipConfig {
  /**
   * The placement of the tooltip.
   * @default 'bottom'
   */
  placement: Placement;

  /**
   * The offset of the tooltip.
   * @see https://popper.js.org/docs/v2/modifiers/offset/#offset-1
   * @default 8
   */
  offset: OffsetOptions | null;

  /**
   * The arrow padding.
   * @see https://popper.js.org/docs/v2/modifiers/arrow/#padding
   * @default 8
   */
  arrowPadding: Padding | null;

  /**
   * The viewport padding.
   * @default 8
   */
  viewportPadding: Padding | null;

  /**
   * Custom class for the tooltip container.
   */
  containerClass?: string | string[];

  /**
   * Whether the tooltip uses a custom animation.
   * @default false
   */
  customAnimated: boolean;
}
