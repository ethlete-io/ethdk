import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, Injector, inject, runInInjectionContext } from '@angular/core';
import { OverlayConfig, OverlayService } from '../../overlay';
import { FILTER_OVERLAY_REF } from '../constants';
import { FilterOverlayConfig } from '../types';
import { FilterOverlayRef } from '../utils';

@Injectable()
export class FilterOverlayService {
  private readonly _overlayService = inject(OverlayService);
  private readonly _injector = inject(Injector);

  readonly positions = this._overlayService.positions;

  open<T, D>(component: ComponentType<T>, config: FilterOverlayConfig<D>) {
    let filterOverlayRef: FilterOverlayRef;

    runInInjectionContext(this._injector, () => {
      filterOverlayRef = new FilterOverlayRef(config);
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

    return this._overlayService.open(component, mergedConfig);
  }
}
