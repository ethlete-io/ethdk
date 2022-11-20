import { Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { InjectionToken } from '@angular/core';
import { BottomSheetConfig } from '../types';

export const BOTTOM_SHEET_MIN_SWIPE_TO_CLOSE_LENGTH = 150;
export const BOTTOM_SHEET_MIN_VELOCITY_TO_CLOSE = 150;

export const BOTTOM_SHEET_TRANSITION_DURATION_PROPERTY = '--et-bottom-sheet-transition-duration';

export const BOTTOM_SHEET_ANIMATION_CLASSES = {
  opening: 'et-bottom-sheet--opening',
  open: 'et-bottom-sheet--open',
  closing: 'et-bottom-sheet--closing',
  closed: 'et-bottom-sheet--closed',
};

/** Injection token that can be used to access the data that was passed in to a bottom sheet. */
export const BOTTOM_SHEET_DATA = new InjectionToken<unknown>('BottomSheetData');

export const BOTTOM_SHEET_DEFAULT_OPTIONS = new InjectionToken<BottomSheetConfig>('BottomSheetDefaultOptions');
export const BOTTOM_SHEET_CONFIG = new InjectionToken<BottomSheetConfig>('BottomSheetConfig');
export const BOTTOM_SHEET_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('BottomSheetScrollStrategy');

export function BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

export const BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER = {
  provide: BOTTOM_SHEET_SCROLL_STRATEGY,
  deps: [Overlay],
  useFactory: BOTTOM_SHEET_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

export function BOTTOM_SHEET_SCROLL_STRATEGY_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

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
  enterAnimationDuration: 300,
  exitAnimationDuration: 100,
} as const;
