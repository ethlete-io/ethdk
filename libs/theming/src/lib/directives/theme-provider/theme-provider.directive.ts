import { Directive, Inject, Input } from '@angular/core';
import { THEME_CONFIG } from '../../constants';
import { Theme, ThemeConfig } from '../../types';
import { THEME_PROVIDER } from './theme-provider.directive.constants';

@Directive({
  selector: 'et-theme-provider',
  standalone: true,
  providers: [{ provide: THEME_PROVIDER, useExisting: ThemeProviderDirective }],
})
export class ThemeProviderDirective {
  @Input()
  theme!: Theme;

  constructor(@Inject(THEME_CONFIG) private _themeConfig: ThemeConfig) {
    if (!this.theme) {
      this.theme = this._themeConfig.defaultTheme;
    }
  }
}
