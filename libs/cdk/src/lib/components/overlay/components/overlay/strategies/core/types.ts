import { PositionStrategy } from '@angular/cdk/overlay';
import { Breakpoint } from '@ethlete/core';
import { OverlayContainerComponent } from '../../common';
import { OverlayRef } from '../../overlay-ref';

export type OverlayStrategyContext<T = unknown, R = unknown> = {
  overlayRef: OverlayRef<T, R>;
  containerEl: HTMLElement;
  containerInstance: OverlayContainerComponent;
  config: OverlayBreakpointConfig;
  previousConfig?: OverlayBreakpointConfig;
  origin?: HTMLElement | Event;
};

export type OverlayStrategy = {
  /** Unique identifier for the strategy */
  id: string;

  /** Configuration for the overlay when this strategy is applied */
  config: OverlayBreakpointConfig;

  /**
   * Called when the overlay transitions FROM another strategy TO this strategy.
   * Only called during breakpoint changes, not on initial open.
   * @example Fullscreen dialog → Regular dialog on viewport resize
   */
  onSwitchedTo?: <T = unknown, R = unknown>(context: OverlayStrategyContext<T, R>) => void;

  /**
   * Called when the overlay transitions FROM this strategy TO another strategy.
   * Only called during breakpoint changes, not on close.
   * Use this to cleanup strategy-specific state when transitioning layouts.
   * @example Regular dialog → Fullscreen dialog on viewport resize
   */
  onSwitchedAwayFrom?: <T = unknown, R = unknown>(context: OverlayStrategyContext<T, R>) => void;

  /**
   * Called when the overlay is first opened with this strategy.
   * Use this for initial setup and enter animations.
   */
  onBeforeEnter?: <T = unknown, R = unknown>(context: OverlayStrategyContext<T, R>) => void;

  /**
   * Called after the overlay has completed its enter animation.
   */
  onAfterEnter?: <T = unknown, R = unknown>(context: OverlayStrategyContext<T, R>) => void;

  /**
   * Called when the overlay is about to close (beforeClosed).
   * Use this to prepare leave animations.
   */
  onBeforeLeave?: <T = unknown, R = unknown>(context: OverlayStrategyContext<T, R>) => void;

  /**
   * Called after the overlay has been closed (afterClosed).
   * Use this for final cleanup.
   */
  onAfterLeave?: <T = unknown, R = unknown>(context: OverlayStrategyContext<T, R>) => void;
};

export type OverlayStrategyBreakpoint = {
  /**
   * Breakpoint to apply the strategy for. If a number is provided, it will be used as a pixel value.
   * Always uses the min-width media query.
   *
   * @default 'xs' // 0px
   */
  breakpoint?: Breakpoint | number;

  /** Overlay strategy to be applied when the breakpoint is active. */
  strategy: OverlayStrategy;
};

/** Possible overrides for a overlay's position. */
export interface OverlayPosition {
  /** Override for the overlay's top position. */
  top?: string;

  /** Override for the overlay's bottom position. */
  bottom?: string;

  /** Override for the overlay's left position. */
  left?: string;

  /** Override for the overlay's right position. */
  right?: string;
}

export interface OverlayDragToDismissConfig {
  /** Direction in which the overlay can be dragged. */
  direction: 'to-top' | 'to-bottom' | 'to-left' | 'to-right';

  /**
   * The minimum distance in pixels that the user must swipe to dismiss the overlay.
   *
   * @default 150 // 150px
   */
  minDistanceToDismiss?: number;

  /**
   * The minimum velocity in pixels per second that the user must swipe to dismiss the overlay.
   *
   * @default 150 // 150px/s
   */
  minVelocityToDismiss?: number;
}

export interface OverlayBreakpointConfig {
  /** Min-width of the overlay. If a number is provided, assumes pixel units. */
  minWidth?: number | string;

  /** Max-width of the overlay. If a number is provided, assumes pixel units. */
  maxWidth?: number | string;

  /** Min-height of the overlay. If a number is provided, assumes pixel units. */
  minHeight?: number | string;

  /** Max-height of the overlay. If a number is provided, assumes pixel units. */
  maxHeight?: number | string;

  /** Width of the overlay. */
  width?: number | string;

  /** Height of the overlay. */
  height?: number | string;

  /** Position strategy to be used for the overlay. */
  positionStrategy?: (origin?: HTMLElement) => PositionStrategy;

  /** Custom class for the overlay container. */
  containerClass?: string | string[];

  /** Custom class for the overlay pane. */
  paneClass?: string | string[];

  /** Extra CSS classes to be added to the overlay overlay container. */
  overlayClass?: string | string[];

  /** Custom class for the backdrop. */
  backdropClass?: string | string[];

  /** Custom class for the document (`<html>` element). */
  documentClass?: string | string[];

  /** Custom class for the `<body>` element */
  bodyClass?: string | string[];

  /** Position overrides. */
  position?: OverlayPosition;

  /** Determine if and in what direction the overlay should be able to be dragged to dismiss it. */
  dragToDismiss?: OverlayDragToDismissConfig;

  /**
   * Whether the transform origin should be set using the config's `origin` property value.
   *
   * @default false
   */
  applyTransformOrigin?: boolean;
}
