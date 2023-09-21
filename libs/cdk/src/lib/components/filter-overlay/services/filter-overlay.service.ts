import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { OverlayConfig, OverlayService } from '../../overlay';
import { FILTER_OVERLAY_REF } from '../constants';
import { FilterOverlayConfig, FilterOverlayResult } from '../types';
import { FilterOverlayRef } from '../utils';

@Injectable()
export class FilterOverlayService {
  private readonly _overlayService = inject(OverlayService);
  private readonly _injector = inject(Injector);

  readonly positions = this._overlayService.positions;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  open<T, D, F extends FormGroup<any>>(component: ComponentType<T>, config: FilterOverlayConfig<F, D>) {
    let filterOverlayRef: FilterOverlayRef<F['controls'], T>;

    runInInjectionContext(this._injector, () => {
      filterOverlayRef = new FilterOverlayRef<F['controls'], T>(config);
    });

    const mergedConfig: OverlayConfig<D> = {
      ...((config.overlay ?? {}) as OverlayConfig<D>),
      providers: [
        {
          provide: FILTER_OVERLAY_REF,
          useValue: filterOverlayRef!,
        },
      ],
    };

    const ref = this._overlayService.open<T, D, FilterOverlayResult>(component, mergedConfig);

    filterOverlayRef!._overlayRef = ref;

    return filterOverlayRef!;
  }
}
