import { ScrollStrategy, ViewportRuler } from '@angular/cdk/overlay';
import { InjectionToken } from '@angular/core';
import { RouterStateService, SmartBlockScrollStrategy } from '@ethlete/core';
import { OverlayConfig } from '../types';

export const OVERLAY_DATA = new InjectionToken('OverlayData');
export const OVERLAY_DEFAULT_OPTIONS = new InjectionToken<OverlayConfig>('OverlayDefaultOptions');
export const OVERLAY_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('OverlayScrollStrategy');
export const OVERLAY_CONFIG = new InjectionToken<OverlayConfig>('OverlayConfig');

export function OVERLAY_SCROLL_STRATEGY_PROVIDER_FACTORY(
  ruler: ViewportRuler,
  routerState: RouterStateService,
): () => ScrollStrategy {
  return () => new SmartBlockScrollStrategy(ruler, routerState, document);
}

export const OVERLAY_SCROLL_STRATEGY_PROVIDER = {
  provide: OVERLAY_SCROLL_STRATEGY,
  deps: [ViewportRuler, RouterStateService],
  useFactory: OVERLAY_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

export const OVERLAY_DEFAULT_CONFIG: OverlayConfig = {
  role: 'dialog',
  hasBackdrop: true,
  disableClose: false,
  data: null,
  ariaDescribedBy: null,
  ariaLabelledBy: null,
  ariaLabel: null,
  ariaModal: true,
  customAnimated: false,
  autoFocus: 'first-tabbable',
  restoreFocus: true,
  delayFocusTrap: true,
  closeOnNavigation: true,
  positions: [
    {
      config: {},
    },
  ],
};
