import { Type } from '@angular/core';
import { createStaticRootProvider } from '@ethlete/core';
import { StreamPlayerErrorComponent } from './error';
import { StreamPlayerLoadingComponent } from './loading';
import { StreamPipChromeComponent } from './pip/pip-chrome.component';

export type StreamPipWindowConfig = {
  /** Minimum allowed width in px. @default 160 */
  minWidth: number;
  /** Maximum allowed width in px. @default 640 */
  maxWidth: number;
  /** Minimum allowed height in px. @default 90 */
  minHeight: number;
  /** Maximum allowed height in px. @default 360 */
  maxHeight: number;
  /** Desired initial size (longest side) in px. @default 400 */
  desiredSize: number;
  /** Height in px of the collapsed peek strip. @default 40 */
  collapsePeek: number;
  /** Minimum distance from the viewport edge in px. @default 8 */
  viewportPadding: number;
};

/**
 * Default pip window sizing / layout config.
 * Spread this when you only want to override a subset of values:
 * `{ ...DEFAULT_PIP_WINDOW_CONFIG, minWidth: 200 }`
 */
export const DEFAULT_PIP_WINDOW_CONFIG: StreamPipWindowConfig = {
  minWidth: 160,
  maxWidth: 640,
  minHeight: 90,
  maxHeight: 360,
  desiredSize: 400,
  collapsePeek: 40,
  viewportPadding: 8,
};

export type StreamConfig = {
  /**
   * An optional consent component to automatically render around stream player components.
   * When set, any stream player component will use this component as its consent gate.
   *
   * The component must have `[etStreamConsent]` as a `hostDirective` (or equivalent consent
   * directive) so the stream player can read the consent state from the injector tree.
   */
  consentComponent: Type<unknown> | null;

  /**
   * An optional component to render inside every player slot as a PIP overlay.
   */
  pipSlotPlaceholderComponent: Type<unknown> | null;

  /**
   * An optional component shown while the player is initializing (before `isReady`).
   * It is automatically destroyed once the player fires its ready event.
   *
   * @default `StreamPlayerLoadingComponent`
   */
  loadingComponent: Type<unknown>;

  /**
   * An optional component shown when the player fails to load (e.g. SDK blocked by an ad-blocker).
   * It is automatically destroyed when the player is retried and hid again when retry succeeds.
   *
   * @default `StreamPlayerErrorComponent`
   */
  errorComponent: Type<unknown>;

  /**
   * The component rendered by `PipManager` when at least one pip is active.
   * It is automatically created when the first pip activates and destroyed
   * after the last pip exits (including exit animations).
   *
   * Supply a custom component that provides `PIP_CHROME_REF_TOKEN` to fully
   * replace the built-in pip chrome UI.
   *
   * @default `StreamPipChromeComponent`
   */
  pipChromeComponent: Type<unknown>;

  /**
   * Sizing and layout defaults for the floating pip window.
   * Override individual values by spreading `DEFAULT_PIP_WINDOW_CONFIG`:
   * `{ ...DEFAULT_PIP_WINDOW_CONFIG, minWidth: 200 }`
   *
   * @default `DEFAULT_PIP_WINDOW_CONFIG`
   */
  pipWindow: StreamPipWindowConfig;
};

export const [provideStreamConfig, injectStreamConfig] = createStaticRootProvider<StreamConfig>(
  {
    consentComponent: null,
    pipSlotPlaceholderComponent: null,
    loadingComponent: StreamPlayerLoadingComponent,
    errorComponent: StreamPlayerErrorComponent,
    pipChromeComponent: StreamPipChromeComponent,
    pipWindow: DEFAULT_PIP_WINDOW_CONFIG,
  },
  { name: 'StreamConfig' },
);
