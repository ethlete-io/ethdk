import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';

export interface ToggletipConfig {
  /**
   * The placement of the toggletip.
   * @default 'bottom'
   */
  placement: Placement;

  /**
   * The offset of the toggletip.
   * @see https://popper.js.org/docs/v2/modifiers/offset/#offset-1
   * @default { mainAxis: 8, crossAxis: 8 }
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
   * Custom class for the toggletip container.
   */
  containerClass?: string | string[];

  /**
   * Whether the toggletip uses a custom animation.
   * @default false
   */
  customAnimated: boolean;
}
