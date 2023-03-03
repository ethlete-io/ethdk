import { Placement as PopperPlacement } from '@popperjs/core';
import { Options as ArrowOptions } from '@popperjs/core/lib/modifiers/arrow';
import { Options as OffsetOptions } from '@popperjs/core/lib/modifiers/offset';

export interface ToggletipConfig {
  /**
   * The placement of the toggletip.
   * @default 'auto'
   */
  placement: PopperPlacement;

  /**
   * The offset of the toggletip.
   * @see https://popper.js.org/docs/v2/modifiers/offset/#offset-1
   * @default [0, 8]
   */
  offset: OffsetOptions['offset'] | Readonly<OffsetOptions['offset']> | null;

  /**
   * The arrow padding.
   * @see https://popper.js.org/docs/v2/modifiers/arrow/#padding
   * @default 4
   */
  arrowPadding: ArrowOptions['padding'] | null;

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
