import { inject, InjectionToken } from '@angular/core';

export const OVERLAY_DATA = new InjectionToken<unknown>('OVERLAY_DATA');

export const injectOverlayData = <TData = unknown>() => inject(OVERLAY_DATA) as TData;
