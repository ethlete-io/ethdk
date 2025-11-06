import { Overlay } from '@angular/cdk/overlay';
import { Injectable, Injector, inject } from '@angular/core';
import { BottomSheetContainerComponent } from '../components/bottom-sheet-container';
import { BOTTOM_SHEET_DATA, BOTTOM_SHEET_DEFAULT_OPTIONS, BOTTOM_SHEET_SCROLL_STRATEGY } from '../constants';
import { BottomSheetConfig } from '../types';
import { BottomSheetRef } from '../utils';
import { BottomSheetServiceBase } from './bottom-sheet-base.service';

/**
 * @deprecated Use `OverlayService` instead. Will be removed in v5.
 */
@Injectable()
export class BottomSheetService extends BottomSheetServiceBase<BottomSheetContainerComponent> {
  constructor() {
    const overlay = inject(Overlay);
    const injector = inject(Injector);
    const defaultOptions = inject<BottomSheetConfig>(BOTTOM_SHEET_DEFAULT_OPTIONS, { optional: true }) || {};
    const scrollStrategy = inject(BOTTOM_SHEET_SCROLL_STRATEGY);
    const parentBottomSheetService = inject(BottomSheetService, { optional: true, skipSelf: true }) || undefined;

    super(
      overlay,
      injector,
      defaultOptions,
      parentBottomSheetService,
      scrollStrategy,
      BottomSheetRef,
      BottomSheetContainerComponent,
      BOTTOM_SHEET_DATA,
    );
  }
}
