import { Directive, InjectionToken, Input, computed, inject, isDevMode, signal } from '@angular/core';
import { THEMES_TOKEN } from '../../constants';
import { createCssThemeName } from '../../utils';

export const THEME_PROVIDER = new InjectionToken<ProvideThemeDirective>('ThemeProvider');

@Directive({
  selector: '[etProvideTheme]',
  standalone: true,
  providers: [{ provide: THEME_PROVIDER, useExisting: ProvideThemeDirective }],
  host: {
    '[class]': 'themeClass()',
  },
})
export class ProvideThemeDirective {
  private readonly _themes = inject(THEMES_TOKEN);

  @Input('etProvideTheme')
  get theme() {
    return this._theme();
  }
  set theme(value: string | null) {
    if (isDevMode() && !this._themes.some((theme) => theme === value) && value !== null) {
      console.warn(`Theme ${value} does not exist. Please make sure to add it to provideThemes()`);
      value = null;
    }

    if (value) {
      value = createCssThemeName(value);
    }

    this._theme.set(value);
  }
  private _theme = signal<string | null>(null);

  @Input('etProvideAltTheme')
  get altTheme() {
    return this._altTheme();
  }
  set altTheme(value: string | null) {
    if (isDevMode() && !this._themes.some((theme) => theme === value) && value !== null) {
      console.warn(`Theme ${value} does not exist. Please make sure to add it to provideThemes()`);
      value = null;
    }

    if (value) {
      value = createCssThemeName(value);
    }

    this._altTheme.set(value);
  }
  private _altTheme = signal<string | null>(null);

  protected themeClass = computed(() => {
    const themes: string[] = [];

    if (this.theme) {
      themes.push(`et-theme--${this.theme}`);
    }

    if (this.altTheme) {
      themes.push(`et-theme-alt--${this.altTheme}`);
    }

    return themes.join(' ');
  });
}
