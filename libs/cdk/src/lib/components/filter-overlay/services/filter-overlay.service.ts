import { ComponentType } from '@angular/cdk/overlay';
import { Injectable, InjectionToken, Injector, inject } from '@angular/core';
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

@Injectable({
  providedIn: 'root',
})
export class FilterOverlayService {
  private readonly _overlayService = inject(OverlayService);
  private readonly _injector = inject(Injector);

  open<T, D>(component: ComponentType<T>, config: FilterOverlayConfig, overlayConfig: OverlayConfig<D>) {
    // TODO: This should be something like a FilterOverlayRef so that it can be kind of a service for the overlay to hold shared state like the current route etc.
    const injector = Injector.create({
      providers: [
        {
          provide: FILTER_OVERLAY_CONFIG_TOKEN,
          useValue: config,
        },
      ],
      parent: overlayConfig?.injector ?? overlayConfig.viewContainerRef?.injector ?? this._injector,
    });

    return this._overlayService.open(component, { ...((overlayConfig ?? {}) as OverlayConfig<D>), injector });
  }
}
