import { Placement as PopperPlacement } from '@popperjs/core';
import { Options as ArrowOptions } from '@popperjs/core/lib/modifiers/arrow';
import { Options as OffsetOptions } from '@popperjs/core/lib/modifiers/offset';

export class TooltipConfig {
  /**
   * The placement of the tooltip.
   */
  placement: PopperPlacement = 'auto';

  /**
   * The offset of the tooltip.
   * @see https://popper.js.org/docs/v2/modifiers/offset/#offset-1
   */
  offset: OffsetOptions['offset'] | null = [0, 8];

  /**
   * The arrow padding.
   * @see https://popper.js.org/docs/v2/modifiers/arrow/#padding
   */
  arrowPadding: ArrowOptions['padding'] | null = 4;

  /** Enter animation duration in ms */
  enterAnimationDuration = 300;

  /** Exit animation duration in ms */
  exitAnimationDuration = 100;

  /** Custom class for the tooltip container. */
  containerClass?: string | string[] = '';

  /**
   * Whether the tooltip uses a custom animation.
   */
  customAnimated?: boolean = false;
}
