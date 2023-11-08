import { ScrollStrategy, ViewportRuler } from '@angular/cdk/overlay';
import { InjectionToken } from '@angular/core';
import { RouterStateService, SmartBlockScrollStrategy } from '@ethlete/core';
import { BottomSheetConfig } from '../types';
/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_MIN_SWIPE_TO_CLOSE_LENGTH = 150;

/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_MIN_VELOCITY_TO_CLOSE = 150;

/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_DATA = new InjectionToken<unknown>('BottomSheetData');

/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_DEFAULT_OPTIONS = new InjectionToken<BottomSheetConfig>('BottomSheetDefaultOptions');

/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_CONFIG = new InjectionToken<BottomSheetConfig>('BottomSheetConfig');

/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('BottomSheetScrollStrategy');

/**
 * @deprecated Will be removed in v5.
 */
export function BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER_FACTORY(
  ruler: ViewportRuler,
  routerState: RouterStateService,
): () => ScrollStrategy {
  return () => new SmartBlockScrollStrategy(ruler, routerState, document);
}

/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER = {
  provide: BOTTOM_SHEET_SCROLL_STRATEGY,
  deps: [ViewportRuler, RouterStateService],
  useFactory: BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

/**
 * @deprecated Will be removed in v5.
 */
export const BOTTOM_SHEET_DEFAULT_CONFIG: BottomSheetConfig = {
  data: null,
  hasBackdrop: true,
  delayFocusTrap: true,
  disableClose: false,
  ariaLabel: null,
  ariaModal: true,
  closeOnNavigation: true,
  autoFocus: 'dialog',
  customAnimated: false,
  restoreFocus: true,
} as const;
