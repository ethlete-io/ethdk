import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, TemplateRef, inject } from '@angular/core';
import { ViewportService } from '@ethlete/core';
import { BottomSheetService, DialogService } from '../components';
import { DynamicOverlayConfig, DynamicOverlayRed } from '../types';

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
