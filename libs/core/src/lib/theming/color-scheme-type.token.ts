import { InjectionToken, Signal } from '@angular/core';
import { SurfaceType } from './surface-theme.util';

export const COLOR_SCHEME_TYPE = new InjectionToken<Signal<SurfaceType>>('ColorSchemeType');
