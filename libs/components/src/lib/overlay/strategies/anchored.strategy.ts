import { OverlayRuntimePositionStrategy, OverlayRuntimeShiftOptions } from '@ethlete/core';
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
  | 'autoHide'
  | 'autoCloseIfReferenceHidden'
  | 'mirrorWidth'
>;

export const buildAnchoredRuntimePositionStrategy =
  (options: AnchoredPositionOptions = {}) =>
  (origin?: HTMLElement): OverlayRuntimePositionStrategy =>
    origin
      ? {
          kind: 'anchored',
          referenceElement: origin,
          placement: options.placement,
          fallbackPlacements: options.fallbackPlacements,
          offset: options.offset,
          arrowPadding: options.arrowPadding,
          viewportPadding: options.viewportPadding,
          shift: options.shift,
          autoResize: options.autoResize,
          autoHide: options.autoHide,
          autoCloseIfReferenceHidden: options.autoCloseIfReferenceHidden,
          mirrorWidth: options.mirrorWidth,
        }
      : { kind: 'global' };

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
      id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
