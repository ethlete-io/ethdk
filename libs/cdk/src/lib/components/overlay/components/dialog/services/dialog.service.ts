import { Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Inject, Injectable, Injector, Optional, SkipSelf } from '@angular/core';
import { DialogContainerComponent } from '../components';
import { DIALOG_DATA, DIALOG_DEFAULT_OPTIONS, DIALOG_SCROLL_STRATEGY } from '../constants';
import { DialogConfig } from '../types';
import { DialogRef } from '../utils';
import { DialogServiceBase } from './dialog-base.service';

/**
 * @deprecated Use `OverlayService` instead. Will be removed in v4.
 */
@Injectable()
export class DialogService extends DialogServiceBase<DialogContainerComponent> {
  constructor(
    overlay: Overlay,
    injector: Injector,
    @Optional() @Inject(DIALOG_DEFAULT_OPTIONS) defaultOptions: DialogConfig,
    @Inject(DIALOG_SCROLL_STRATEGY) scrollStrategy: () => ScrollStrategy,
    @Optional() @SkipSelf() parentDialogService: DialogService,
  ) {
    super(
      overlay,
      injector,
      defaultOptions,
      parentDialogService,
      scrollStrategy,
      DialogRef,
      DialogContainerComponent,
      DIALOG_DATA,
    );
  }
}
