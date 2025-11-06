import { Overlay } from '@angular/cdk/overlay';
import { Injectable, Injector, inject } from '@angular/core';
import { DialogContainerComponent } from '../components/dialog-container';
import { DIALOG_DATA, DIALOG_DEFAULT_OPTIONS, DIALOG_SCROLL_STRATEGY } from '../constants';
import { DialogConfig } from '../types';
import { DialogRef } from '../utils';
import { DialogServiceBase } from './dialog-base.service';

/**
 * @deprecated Use `OverlayService` instead. Will be removed in v5.
 */
@Injectable()
export class DialogService extends DialogServiceBase<DialogContainerComponent> {
  constructor() {
    const overlay = inject(Overlay);
    const injector = inject(Injector);
    const defaultOptions = inject<DialogConfig>(DIALOG_DEFAULT_OPTIONS, { optional: true }) || {};
    const scrollStrategy = inject(DIALOG_SCROLL_STRATEGY);
    const parentDialogService = inject(DialogService, { optional: true, skipSelf: true }) || undefined;

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
