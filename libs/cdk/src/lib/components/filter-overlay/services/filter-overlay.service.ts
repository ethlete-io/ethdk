import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { OverlayConfig, OverlayService } from '../../overlay';

export interface FilterOverlayConfig {
  id: string;
  form: FormGroup;
  defaultFormValue: unknown;
  initialRoute?: string;
  pages: {
    component: ComponentType<unknown>;
    route: string;
    inputs?: Record<string, unknown>;
  }[];
}

export const FILTER_OVERLAY_CONFIG_TOKEN = new InjectionToken<FilterOverlayConfig>('FILTER_OVERLAY_CONFIG_TOKEN');

@Injectable()
export class FilterOverlayService {
  private readonly _overlayService = inject(OverlayService);

  readonly positions = this._overlayService.positions;

  open<T, D>(component: ComponentType<T>, config: FilterOverlayConfig, overlayConfig: OverlayConfig<D>) {
    // TODO: This should be something like a FilterOverlayRef so that it can be kind of a service for the overlay to hold shared state like the current route etc.
    const mergedConfig: OverlayConfig<D> = {
      ...((overlayConfig ?? {}) as OverlayConfig<D>),
      providers: [
        {
          provide: FILTER_OVERLAY_CONFIG_TOKEN,
          useValue: config,
        },
      ],
    };

    return this._overlayService.open(component, mergedConfig);
  }
}
