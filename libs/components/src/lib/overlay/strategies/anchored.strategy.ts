import {
  OverlayRuntimePositionStrategy,
  OverlayRuntimeShiftOptions,
  anchoredOverlayPosition,
  enableAnchoredOverlayPositionExtras,
  randomId,
} from '@ethlete/core';
import { OffsetOptions, Padding, Placement } from '@floating-ui/dom';
import { OverlayBreakpointConfig, OverlayStrategy, OverlayStrategyBreakpoint } from './overlay-strategy.types';

export type AnchoredOverlayStrategyOptions = {
  containerClass?: string | string[];
  hostClass?: string | string[];
  maxWidth?: number | string;
  maxHeight?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;

  placement?: Placement;
  fallbackPlacements?: Placement[];
  offset?: OffsetOptions | null;
  arrowPadding?: Padding | null;
  viewportPadding?: Padding | null;
  shift?: boolean | OverlayRuntimeShiftOptions;
  autoResize?: boolean;
  /**
   * Minimum space (px) the placement's own side must offer before the pane moves to the opposite one.
   * Keeps a scrollable pane below its field with a shorter list rather than flipping it above, and -
   * unlike `fallbackPlacements` - is never re-decided by the pane's content changing while it is
   * open. Requires `autoResize`; replaces `fallbackPlacements`.
   */
  minAvailableSpace?: number;
  autoHide?: boolean;
  autoCloseIfReferenceHidden?: boolean;
  mirrorWidth?: boolean;

  /** Render a floating-ui-positioned arrow on the container pointing at the origin. */
  arrow?: boolean;
};

export type CenteredOverlayStrategyOptions = {
  containerClass?: string | string[];
  hostClass?: string | string[];
  maxWidth?: number | string;
  maxHeight?: number | string;
  minWidth?: number | string;
  minHeight?: number | string;
};

export type AnchoredPositionOptions = Pick<
  AnchoredOverlayStrategyOptions,
  | 'placement'
  | 'fallbackPlacements'
  | 'offset'
  | 'arrowPadding'
  | 'viewportPadding'
  | 'shift'
  | 'autoResize'
  | 'minAvailableSpace'
  | 'autoHide'
  | 'autoCloseIfReferenceHidden'
  | 'mirrorWidth'
>;

export const buildAnchoredRuntimePositionStrategy =
  (options: AnchoredPositionOptions = {}) =>
  (origin?: HTMLElement): OverlayRuntimePositionStrategy => {
    // the strategy exposes autoResize/autoHide/arrow, all of which need the extra middleware
    enableAnchoredOverlayPositionExtras();

    return origin
      ? anchoredOverlayPosition({
          referenceElement: origin,
          placement: options.placement,
          fallbackPlacements: options.fallbackPlacements,
          offset: options.offset,
          arrowPadding: options.arrowPadding,
          viewportPadding: options.viewportPadding,
          shift: options.shift,
          autoResize: options.autoResize,
          minAvailableSpace: options.minAvailableSpace,
          autoHide: options.autoHide,
          autoCloseIfReferenceHidden: options.autoCloseIfReferenceHidden,
          mirrorWidth: options.mirrorWidth,
        })
      : { kind: 'global' };
  };

const buildAnchoredConfig = (options: AnchoredOverlayStrategyOptions): OverlayBreakpointConfig => ({
  containerClass: options.containerClass,
  hostClass: options.hostClass,
  maxWidth: options.maxWidth,
  maxHeight: options.maxHeight,
  minWidth: options.minWidth,
  minHeight: options.minHeight,
  arrow: options.arrow,
  positionStrategy: buildAnchoredRuntimePositionStrategy(options),
});

export const anchoredOverlayStrategy = (
  options: AnchoredOverlayStrategyOptions = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategy: OverlayStrategy = {
      id: randomId(),
      config: buildAnchoredConfig(options),
    };

    return [{ strategy }];
  };
};

export const centeredOverlayStrategy = (
  options: CenteredOverlayStrategyOptions = {},
): (() => OverlayStrategyBreakpoint[]) => {
  return () => {
    const strategy: OverlayStrategy = {
      id: randomId(),
      config: {
        containerClass: options.containerClass,
        hostClass: options.hostClass,
        maxWidth: options.maxWidth,
        maxHeight: options.maxHeight,
        minWidth: options.minWidth,
        minHeight: options.minHeight,
        positionStrategy: () => ({ kind: 'center' }),
      },
    };

    return [{ strategy }];
  };
};
