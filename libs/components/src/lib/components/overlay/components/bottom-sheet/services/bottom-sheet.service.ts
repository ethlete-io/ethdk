import { Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Inject, Injectable, Injector, Optional, SkipSelf } from '@angular/core';
import { BottomSheetContainerComponent } from '../components';
import { BOTTOM_SHEET_DATA, BOTTOM_SHEET_DEFAULT_OPTIONS, BOTTOM_SHEET_SCROLL_STRATEGY } from '../constants';
import { BottomSheetConfig, BottomSheetRef } from '../utils';
import { BottomSheetServiceBase } from './bottom-sheet-base.service';

@Injectable()
export class BottomSheetService extends BottomSheetServiceBase<BottomSheetContainerComponent> {
  constructor(
    overlay: Overlay,
    injector: Injector,
    @Optional() @Inject(BOTTOM_SHEET_DEFAULT_OPTIONS) defaultOptions: BottomSheetConfig,
    @Inject(BOTTOM_SHEET_SCROLL_STRATEGY) scrollStrategy: () => ScrollStrategy,
    @Optional() @SkipSelf() parentBottomSheetService: BottomSheetService,
  ) {
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
