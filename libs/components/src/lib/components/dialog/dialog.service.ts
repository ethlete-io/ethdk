import { Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Inject, Injectable, Injector, Optional, SkipSelf } from '@angular/core';
import { DialogServiceBase } from './dialog-base.service';
import { DialogConfig } from './dialog-config';
import { DialogContainerComponent } from './dialog-container.component';
import { DialogRef } from './dialog-ref';
import { DIALOG_DATA, DIALOG_DEFAULT_OPTIONS, DIALOG_SCROLL_STRATEGY } from './dialog.constants';

@Injectable()
export class DialogService extends DialogServiceBase<DialogContainerComponent> {
  constructor(
    overlay: Overlay,
    injector: Injector,
    @Optional() @Inject(DIALOG_DEFAULT_OPTIONS) defaultOptions: DialogConfig,
    @Inject(DIALOG_SCROLL_STRATEGY) scrollStrategy: () => ScrollStrategy,
    @Optional() @SkipSelf() parentDialog: DialogService,
  ) {
    super(
      overlay,
      injector,
      defaultOptions,
      parentDialog,
      scrollStrategy,
      DialogRef,
      DialogContainerComponent,
      DIALOG_DATA,
    );
  }
}
