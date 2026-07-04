import {
  AnimatedLifecycleDirective,
  Breakpoint,
  OverlayRuntimePositionStrategy,
  OverlayRuntimeRef,
} from '@ethlete/core';
import { OverlayRef } from '../overlay-ref';

export type OverlayStrategyContext = {
  overlayRef: OverlayRef<object, unknown>;
  runtimeRef: OverlayRuntimeRef<object, unknown>;

  /** The mounted container component's host element (the runtime pane element). */
  containerEl: HTMLElement;

  /** The runtime host element wrapping backdrop and pane. */
  hostEl: HTMLElement;

  backdropEl: HTMLElement | null;

  /** The container's animated lifecycle, driving enter/leave transitions. */
  lifecycle: AnimatedLifecycleDirective;

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
  onSwitchedTo?: (context: OverlayStrategyContext) => void;

  /**
   * Called when the overlay transitions FROM this strategy TO another strategy.
   * Only called during breakpoint changes, not on close.
   * Use this to cleanup strategy-specific state when transitioning layouts.
   * @example Regular dialog → Fullscreen dialog on viewport resize
   */
  onSwitchedAwayFrom?: (context: OverlayStrategyContext) => void;

  /**
   * Called when the overlay is first opened with this strategy.
   * Use this for initial setup and enter animations.
   * The hook is responsible for starting the enter transition (e.g. `context.lifecycle.enter()`).
   */
  onBeforeEnter?: (context: OverlayStrategyContext) => void;

  /**
   * Called after the overlay has completed its enter animation.
   */
  onAfterEnter?: (context: OverlayStrategyContext) => void;

  /**
   * Called when the overlay is about to close (beforeClosed).
   * The hook is responsible for starting the leave transition (e.g. `context.lifecycle.leave()`).
   */
  onBeforeLeave?: (context: OverlayStrategyContext) => void;

  /**
   * Called after the overlay has been closed (afterClosed).
   * Use this for final cleanup.
   */
  onAfterLeave?: (context: OverlayStrategyContext) => void;
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

export type OverlayDragToDismissConfig = {
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
};

export type OverlayBreakpointConfig = {
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
  positionStrategy?: (origin?: HTMLElement) => OverlayRuntimePositionStrategy;

  /** Custom class for the overlay container (the runtime pane element hosting the overlay content). */
  containerClass?: string | string[];

  /** Custom class for the runtime host element wrapping backdrop and pane. */
  hostClass?: string | string[];

  /** Custom class for the backdrop. */
  backdropClass?: string | string[];

  /** Custom class for the document (`<html>` element). */
  documentClass?: string | string[];

  /** Custom class for the `<body>` element */
  bodyClass?: string | string[];

  /** Determine if and in what direction the overlay should be able to be dragged to dismiss it. */
  dragToDismiss?: OverlayDragToDismissConfig;

  /**
   * Whether a backdrop element is rendered behind the overlay. Only applied at mount time (the
   * initially matched strategy) — it cannot change during breakpoint switches. An explicit
   * `hasBackdrop` on the overlay config always wins over this strategy default.
   *
   * @default undefined // falls back to the overlay config / modal behavior
   */
  hasBackdrop?: boolean;

  /**
   * Whether the transform origin should be set using the config's `origin` property value.
   *
   * @default false
   */
  applyTransformOrigin?: boolean;

  /**
   * Renders a floating-ui-positioned arrow on the overlay container that points at the origin.
   * Only meaningful for anchored positioning. The arrow inherits the pane background; combine with
   * an `offset` so the pane leaves room for it.
   *
   * @default false
   */
  arrow?: boolean;
};
