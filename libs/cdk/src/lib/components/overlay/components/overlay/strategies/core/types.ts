import { Breakpoint } from '@ethlete/core';
import { OverlayContainerComponent } from '../../components/overlay-container';
import { OverlayBreakpointConfig } from '../../types';
import { OverlayRef } from '../../utils';

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
