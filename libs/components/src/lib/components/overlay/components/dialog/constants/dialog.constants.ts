import { Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { InjectionToken } from '@angular/core';
import { DialogConfig } from '../types';

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
export const DIALOG_CONFIG = new InjectionToken<DialogConfig>('DialogConfig');

export function DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY(overlay: Overlay): () => ScrollStrategy {
  return () => overlay.scrollStrategies.block();
}

export const DIALOG_SCROLL_STRATEGY_PROVIDER = {
  provide: DIALOG_SCROLL_STRATEGY,
  deps: [Overlay],
  useFactory: DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

export const DIALOG_DEFAULT_CONFIG: DialogConfig = {
  role: 'dialog',
  hasBackdrop: true,
  disableClose: false,
  maxWidth: '80vw',
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
  enterAnimationDuration: 300,
  exitAnimationDuration: 100,
} as const;
