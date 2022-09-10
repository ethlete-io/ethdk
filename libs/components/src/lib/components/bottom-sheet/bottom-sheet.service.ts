import { Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Inject, Injectable, Injector, Optional, SkipSelf } from '@angular/core';
import { DialogConfig, DialogRef, DIALOG_DATA, DIALOG_DEFAULT_OPTIONS, DIALOG_SCROLL_STRATEGY } from '../dialog';
import { DialogServiceBase } from '../dialog/dialog-base.service';
import { BottomSheetContainerComponent } from './bottom-sheet-container.component';

@Injectable()
export class BottomSheetService extends DialogServiceBase<BottomSheetContainerComponent> {
  constructor(
    overlay: Overlay,
    injector: Injector,
    @Optional() @Inject(DIALOG_DEFAULT_OPTIONS) defaultOptions: DialogConfig,
    @Inject(DIALOG_SCROLL_STRATEGY) scrollStrategy: () => ScrollStrategy,
    @Optional() @SkipSelf() parentBottomSheetService: BottomSheetService,
  ) {
    const defaultOpts = defaultOptions || new DialogConfig();
    defaultOpts.position = { bottom: '0' };
    defaultOpts.width = '100%';
    defaultOpts.maxWidth = '640px';
    defaultOpts.height = 'auto';
    defaultOpts.maxHeight = 'calc(100% - 72px)';

    super(
      overlay,
      injector,
      defaultOpts,
      parentBottomSheetService,
      scrollStrategy,
      DialogRef,
      BottomSheetContainerComponent,
      DIALOG_DATA,
    );
  }
}
