import { ScrollStrategy, ViewportRuler } from '@angular/cdk/overlay';
import { InjectionToken } from '@angular/core';
import { RouterStateService, SmartBlockScrollStrategy } from '@ethlete/core';
import { DialogConfig } from '../types';

export const DIALOG_DATA = new InjectionToken('DialogData');
export const DIALOG_DEFAULT_OPTIONS = new InjectionToken<DialogConfig>('DialogDefaultOptions');
export const DIALOG_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('DialogScrollStrategy');
export const DIALOG_CONFIG = new InjectionToken<DialogConfig>('DialogConfig');

export function DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY(
  ruler: ViewportRuler,
  routerState: RouterStateService,
): () => ScrollStrategy {
  return () => new SmartBlockScrollStrategy(ruler, routerState, document);
}

export const DIALOG_SCROLL_STRATEGY_PROVIDER = {
  provide: DIALOG_SCROLL_STRATEGY,
  deps: [ViewportRuler, RouterStateService],
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
} as const;
