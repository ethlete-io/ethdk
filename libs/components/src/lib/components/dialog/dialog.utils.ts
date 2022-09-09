import { ElementRef } from '@angular/core';
import { DialogRef } from './dialog-ref';

/**
 * Finds the closest DialogRef to an element by looking at the DOM.
 * @param element Element relative to which to look for a dialog.
 * @param openDialogs References to the currently-open dialogs.
 */
export function getClosestDialog(element: ElementRef<HTMLElement>, openDialogs: DialogRef<unknown>[]) {
  let parent: HTMLElement | null = element.nativeElement.parentElement;

  while (parent && !parent.classList.contains('et-dialog')) {
    parent = parent.parentElement;
  }

  return parent ? openDialogs.find((dialog) => dialog.id === parent?.id) : null;
}
