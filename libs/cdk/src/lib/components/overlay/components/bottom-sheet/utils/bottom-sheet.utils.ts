import { ElementRef } from '@angular/core';
import { BOTTOM_SHEET_DEFAULT_OPTIONS } from '../constants';
import { BottomSheetConfig } from '../types';
import { createBottomSheetConfig } from './bottom-sheet-config';
import { BottomSheetRef } from './bottom-sheet-ref';

/**
 * Finds the closest BottomSheetRef to an element by looking at the DOM.
 * @param element Element relative to which to look for a bottom sheet.
 * @param openBottomSheets References to the currently-open bottom sheets.
 * @deprecated Will be removed in v5.
 */
export function getClosestBottomSheet(element: ElementRef<HTMLElement>, openBottomSheets: BottomSheetRef<unknown>[]) {
  let parent: HTMLElement | null = element.nativeElement.parentElement;

  while (parent && !parent.classList.contains('et-bottom-sheet')) {
    parent = parent.parentElement;
  }

  return parent ? openBottomSheets.find((bottomSheet) => bottomSheet.id === parent?.id) : null;
}

/**
 * @deprecated Will be removed in v5.
 */
export const provideBottomSheetDefaultConfig = (config: Partial<BottomSheetConfig> | null | undefined = {}) => {
  return { provide: BOTTOM_SHEET_DEFAULT_OPTIONS, useValue: createBottomSheetConfig(config) };
};
