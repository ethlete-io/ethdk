import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, TemplateRef, inject } from '@angular/core';
import { ViewportService } from '@ethlete/core';
import { BottomSheetService } from '../components/bottom-sheet/services';
import { DialogService } from '../components/dialog/services';
import { DynamicOverlayConfig, DynamicOverlayRed } from '../types';

/**
 * @deprecated Use `OverlayService` instead. Will be removed in v5.
 */
@Injectable({
  providedIn: 'root',
})
export class DynamicOverlayService {
  private readonly _dialogService = inject(DialogService);
  private readonly _bottomSheetService = inject(BottomSheetService);
  private readonly _viewportService = inject(ViewportService);

  open<T, D = unknown, R = unknown>(
    component: ComponentType<T>,
    config: DynamicOverlayConfig<D>,
  ): DynamicOverlayRed<T, R>;

  open<T, D = unknown, R = unknown>(template: TemplateRef<T>, config: DynamicOverlayConfig<D>): DynamicOverlayRed<T, R>;

  open<T, D = unknown, R = unknown>(
    template: ComponentType<T> | TemplateRef<T>,
    config: DynamicOverlayConfig<D>,
  ): DynamicOverlayRed<T, R>;

  open<T, D = unknown, R = unknown>(
    componentOrTemplateRef: ComponentType<T> | TemplateRef<T>,
    config: DynamicOverlayConfig<D>,
  ): DynamicOverlayRed<T, R> {
    const shouldOpenAsDialog = this._viewportService.isMatched({ min: config.isDialogFrom });

    if (shouldOpenAsDialog) {
      return this._dialogService.open<T, D, R>(componentOrTemplateRef, config.dialogConfig);
    }

    return this._bottomSheetService.open<T, D, R>(componentOrTemplateRef, config.bottomSheetConfig);
  }
}
