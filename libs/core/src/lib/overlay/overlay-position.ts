import { isDevMode } from '@angular/core';
import { AngularRenderer } from '../providers';
import { OverlayRuntimeRef } from './overlay-runtime-ref';
import {
  OverlayRuntimeAnchoredPosition,
  OverlayRuntimeCenteredPosition,
  OverlayRuntimeGlobalPosition,
  OverlayRuntimeMountConfig,
} from './overlay-runtime.types';
import { onOverlayViewportInsetsChange, overlayViewportInsetsFor } from './overlay-viewport-inset';

/**
 * Shrinks the host box to the part of the viewport nothing above this overlay has reserved, so a
 * centered or globally placed pane is laid out inside it instead of under a docked panel.
 */
const applyViewportInsets = (hostElement: HTMLElement, renderer: AngularRenderer) => {
  const insets = overlayViewportInsetsFor(hostElement);

  renderer.setStyle(hostElement, {
    top: `${insets.top}px`,
    right: `${insets.right}px`,
    bottom: `${insets.bottom}px`,
    left: `${insets.left}px`,
  });
};

export const setBaseElementStyles = (
  config: OverlayRuntimeMountConfig<object>,
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
) => {
  renderer.setStyle(hostElement, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    display: 'block',
    pointerEvents: config.hasBackdrop === false ? 'none' : 'auto',
  });

  renderer.setStyle(paneElement, {
    pointerEvents: 'auto',
    outline: 'none',
  });
};

export const setBackdropStyles = (backdropElement: HTMLElement, renderer: AngularRenderer) => {
  renderer.setStyle(backdropElement, {
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
  });
};

export const applyCenteredPosition = (
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
  _config: OverlayRuntimeCenteredPosition,
) => {
  renderer.setStyle(hostElement, {
    display: 'grid',
    placeItems: 'center',
    padding: '16px',
    overflow: 'auto',
  });

  applyViewportInsets(hostElement, renderer);

  renderer.setStyle(paneElement, {
    position: 'relative',
  });
};

export const applyGlobalPosition = (
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
  config: OverlayRuntimeGlobalPosition,
) => {
  renderer.setStyle(hostElement, {
    display: 'grid',
    // an explicit full-size cell keeps the grid area definite so percentage
    // based pane sizes (e.g. max-height: calc(100% - 72px)) can resolve
    gridTemplateRows: '100%',
    gridTemplateColumns: '100%',
    placeItems: `${config.vertical ?? 'center'} ${config.horizontal ?? 'center'}`,
    padding: config.padding ?? '0',
  });

  applyViewportInsets(hostElement, renderer);

  renderer.setStyle(paneElement, {
    position: 'relative',
  });
};

/**
 * Clears every inline style any position strategy kind may have set and
 * restores the base element styles, so a different strategy can be applied afterwards.
 */
export const resetPositioningStyles = (
  config: OverlayRuntimeMountConfig<object>,
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  renderer: AngularRenderer,
) => {
  renderer.setStyle(hostElement, {
    gridTemplateRows: null,
    gridTemplateColumns: null,
    placeItems: null,
    padding: null,
    overflow: null,
  });

  renderer.setStyle(paneElement, {
    position: null,
    top: null,
    left: null,
    width: null,
    transform: null,
    visibility: null,
  });

  renderer.setCssProperties(paneElement, {
    '--et-overlay-max-width': null,
    '--et-overlay-max-height': null,
    '--et-overlay-anchored-x': null,
    '--et-overlay-anchored-y': null,
  });

  renderer.removeAttribute(paneElement, 'data-overlay-placement');

  setBaseElementStyles(config, hostElement, paneElement, renderer);
};

/**
 * Positions an anchored overlay pane and returns the cleanup for its auto-update loop.
 */
export type AnchoredPositionSetup = (
  strategy: OverlayRuntimeAnchoredPosition,
  paneElement: HTMLElement,
  overlayRef: OverlayRuntimeRef<object, unknown>,
  renderer: AngularRenderer,
) => () => void;

let anchoredPositionSetup: AnchoredPositionSetup | null = null;

/**
 * Installs the anchored positioning implementation. Called by `anchoredOverlayPosition()`, which is
 * the only thing that pulls `@floating-ui/dom` into the bundle - apps that never anchor an overlay
 * do not ship it.
 *
 * @internal
 */
export const registerAnchoredPositionSetup = (setup: AnchoredPositionSetup) => {
  anchoredPositionSetup = setup;
};

export const setupPositioning = (
  config: OverlayRuntimeMountConfig<object>,
  hostElement: HTMLElement,
  paneElement: HTMLElement,
  overlayRef: OverlayRuntimeRef<object, unknown>,
  renderer: AngularRenderer,
) => {
  const strategy = config.positionStrategy ?? { kind: 'center' };

  if (strategy.kind === 'anchored') {
    renderer.setStyle(hostElement, {
      pointerEvents: config.hasBackdrop === false ? 'none' : 'auto',
    });

    if (!anchoredPositionSetup) {
      if (isDevMode()) {
        console.error(
          'An overlay was mounted with an anchored position strategy, but anchored positioning is not installed. Build the strategy with `anchoredOverlayPosition()` from @ethlete/core so the positioning code is part of the bundle.',
          strategy,
        );
      }

      applyCenteredPosition(hostElement, paneElement, renderer, { kind: 'center' });

      return () => undefined;
    }

    return anchoredPositionSetup(strategy, paneElement, overlayRef, renderer);
  }

  if (strategy.kind === 'global') {
    applyGlobalPosition(hostElement, paneElement, renderer, strategy);

    return onOverlayViewportInsetsChange(() => applyViewportInsets(hostElement, renderer));
  }

  applyCenteredPosition(hostElement, paneElement, renderer, strategy);

  return onOverlayViewportInsetsChange(() => applyViewportInsets(hostElement, renderer));
};
