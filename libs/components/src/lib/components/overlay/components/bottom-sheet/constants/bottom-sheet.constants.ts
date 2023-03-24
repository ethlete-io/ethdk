import { ScrollStrategy, ViewportRuler } from '@angular/cdk/overlay';
import { InjectionToken } from '@angular/core';
import { RouterStateService, SmartBlockScrollStrategy } from '@ethlete/core';
import { BottomSheetConfig } from '../types';

export const BOTTOM_SHEET_MIN_SWIPE_TO_CLOSE_LENGTH = 150;
export const BOTTOM_SHEET_MIN_VELOCITY_TO_CLOSE = 150;

export const BOTTOM_SHEET_DATA = new InjectionToken<unknown>('BottomSheetData');

export const BOTTOM_SHEET_DEFAULT_OPTIONS = new InjectionToken<BottomSheetConfig>('BottomSheetDefaultOptions');
export const BOTTOM_SHEET_CONFIG = new InjectionToken<BottomSheetConfig>('BottomSheetConfig');
export const BOTTOM_SHEET_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('BottomSheetScrollStrategy');

export function BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER_FACTORY(
  ruler: ViewportRuler,
  routerState: RouterStateService,
): () => ScrollStrategy {
  return () => new SmartBlockScrollStrategy(ruler, routerState, document);
}

export const BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER = {
  provide: BOTTOM_SHEET_SCROLL_STRATEGY,
  deps: [ViewportRuler, RouterStateService],
  useFactory: BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

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
