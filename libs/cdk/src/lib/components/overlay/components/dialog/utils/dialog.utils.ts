import { ElementRef } from '@angular/core';
import { DIALOG_DEFAULT_OPTIONS } from '../constants';
import { DialogConfig } from '../types';
import { createDialogConfig } from './dialog-config';
import { DialogRef } from './dialog-ref';

/**
 * Finds the closest DialogRef to an element by looking at the DOM.
 * @param element Element relative to which to look for a dialog.
 * @param openDialogs References to the currently-open dialogs.
 * @deprecated Will be removed in v5.
 */
export function getClosestDialog(element: ElementRef<HTMLElement>, openDialogs: DialogRef<unknown>[]) {
  let parent: HTMLElement | null = element.nativeElement.parentElement;

  while (parent && !parent.classList.contains('et-dialog')) {
    parent = parent.parentElement;
  }

  return parent ? openDialogs.find((dialog) => dialog.id === parent?.id) : null;
}

/**
 * @deprecated Will be removed in v5.
 */
export const provideDialogDefaultConfig = (config: Partial<DialogConfig> | null | undefined = {}) => {
  return { provide: DIALOG_DEFAULT_OPTIONS, useValue: createDialogConfig(config) };
};
