import { Placement as PopperPlacement } from '@popperjs/core';
import { Options as ArrowOptions } from '@popperjs/core/lib/modifiers/arrow';
import { Options as OffsetOptions } from '@popperjs/core/lib/modifiers/offset';

export class ToggletipConfig {
  /**
   * The placement of the toggletip.
   */
  placement: PopperPlacement = 'auto';

  /**
   * The offset of the toggletip.
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
}
