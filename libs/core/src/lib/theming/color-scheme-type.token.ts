import { InjectionToken, Signal } from '@angular/core';
import { SurfaceType } from './surface-theme.util';

export const COLOR_SCHEME_TYPE = new InjectionToken<Signal<SurfaceType>>('ColorSchemeType');

/** True while the scheme is only known to CSS: a server render in `system` mode with a default per surface type. */
export const COLOR_SCHEME_UNRESOLVED = new InjectionToken<Signal<boolean>>('ColorSchemeUnresolved');
