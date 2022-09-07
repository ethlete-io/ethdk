import { InjectionToken } from '@angular/core';
import { ThemeProviderDirective } from './theme-provider.directive';

export const THEME_PROVIDER = new InjectionToken<ThemeProviderDirective>('ThemeProvider');
