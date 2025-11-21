import { ScrollStrategy } from '@angular/cdk/overlay';
import { InjectionToken, Injector, runInInjectionContext } from '@angular/core';
import { SmartBlockScrollStrategy } from '../../../services';
import { DialogConfig } from '../types';

/**
 * @deprecated Will be removed in v5.
 */
export const DIALOG_DATA = new InjectionToken('DialogData');

/**
 * @deprecated Will be removed in v5.
 */
export const DIALOG_DEFAULT_OPTIONS = new InjectionToken<DialogConfig>('DialogDefaultOptions');

/**
 * @deprecated Will be removed in v5.
 */
export const DIALOG_SCROLL_STRATEGY = new InjectionToken<() => ScrollStrategy>('DialogScrollStrategy');

/**
 * @deprecated Will be removed in v5.
 */
export const DIALOG_CONFIG = new InjectionToken<DialogConfig>('DialogConfig');

/**
 * @deprecated Will be removed in v5.
 */
export function DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY(injector: Injector): () => ScrollStrategy {
  return () => runInInjectionContext(injector, () => new SmartBlockScrollStrategy());
}

/**
 * @deprecated Will be removed in v5.
 */
export const DIALOG_SCROLL_STRATEGY_PROVIDER = {
  provide: DIALOG_SCROLL_STRATEGY,
  deps: [Injector],
  useFactory: DIALOG_SCROLL_STRATEGY_PROVIDER_FACTORY,
};

/**
 * @deprecated Will be removed in v5.
 */
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
