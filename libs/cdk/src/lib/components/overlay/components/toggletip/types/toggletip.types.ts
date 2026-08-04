import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export type ToggletipConfig = {
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
};
