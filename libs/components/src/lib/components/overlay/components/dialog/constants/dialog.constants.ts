import { ScrollStrategy, Overlay } from '@angular/cdk/overlay';
import { InjectionToken } from '@angular/core';
import { DialogConfig } from '../utils';

export const DIALOG_TRANSITION_DURATION_PROPERTY = '--et-dialog-transition-duration';

export const DIALOG_ANIMATION_CLASSES = {
  opening: 'et-dialog--opening',
  open: 'et-dialog--open',
  closing: 'et-dialog--closing',
  closed: 'et-dialog--closed',
};

export const DIALOG_DATA = new InjectionToken('DialogData');
export const DIALOG_DEFAULT_OPTIONS = new InjectionToken<DialogConfig>('DialogDefaultOptions');
export const DIALOG_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('DialogScrollStrategy');

export function DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

export const DIALOG_SCROLL_STRATEGY_PROVIDER = {
  provide: DIALOG_SCROLL_STRATEGY,
  deps: [Overlay],
  useFactory: DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

export function DIALOG_SCROLL_STRATEGY_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}
