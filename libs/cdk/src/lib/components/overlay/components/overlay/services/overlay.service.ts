import { Overlay, ScrollStrategy } from '@angular/cdk/overlay';
import { Inject, Injectable, Injector, Optional, SkipSelf } from '@angular/core';
import { OverlayContainerComponent } from '../components';
import { OVERLAY_DATA, OVERLAY_DEFAULT_OPTIONS, OVERLAY_SCROLL_STRATEGY } from '../constants';
import { OverlayConfig } from '../types';
import { OverlayRef } from '../utils';
import { OverlayServiceBase } from './overlay-base.service';

@Injectable()
export class OverlayService extends OverlayServiceBase<OverlayContainerComponent> {
  constructor(
    overlay: Overlay,
    injector: Injector,
    @Optional() @Inject(OVERLAY_DEFAULT_OPTIONS) defaultOptions: OverlayConfig,
    @Inject(OVERLAY_SCROLL_STRATEGY) scrollStrategy: () => ScrollStrategy,
    @Optional() @SkipSelf() parentOverlayService: OverlayService,
  ) {
    super(
      overlay,
      injector,
      defaultOptions,
      parentOverlayService,
      scrollStrategy,
      OverlayRef,
      OverlayContainerComponent,
      OVERLAY_DATA,
    );
  }
}
