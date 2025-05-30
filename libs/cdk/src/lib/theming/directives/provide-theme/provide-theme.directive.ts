import {
  Directive,
  EffectRef,
  InjectionToken,
  Injector,
  Input,
  computed,
  effect,
  inject,
  isDevMode,
  runInInjectionContext,
  signal,
} from '@angular/core';
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
  private readonly _themes = inject(THEMES_TOKEN, { optional: true });
  private readonly _injector = inject(Injector);

  private _currentProviderSync: EffectRef | null = null;

  @Input('etProvideTheme')
  get theme() {
    return this._theme();
  }
  set theme(value: string | null) {
    if (isDevMode() && !this._themes) {
      console.error(`No themes provided. Please make sure to add provideThemes() to your app config`);
      return;
    }

    if (isDevMode() && !this._themes?.some((theme) => theme === value) && value !== null) {
      console.error(`Theme ${value} does not exist. Please make sure to add it to provideThemes()`);
      value = null;
    }

    if (value) {
      value = createCssThemeName(value);
    }

    this._theme.set(value);
  }
  readonly _theme = signal<string | null>(null);

  @Input('etProvideAltTheme')
  get altTheme() {
    return this._altTheme();
  }
  set altTheme(value: string | null) {
    if (isDevMode() && !this._themes) {
      console.error(`No themes provided. Please make sure to add provideThemes() to your app config`);
      return;
    }

    if (isDevMode() && !this._themes?.some((theme) => theme === value) && value !== null) {
      console.warn(`Theme ${value} does not exist. Please make sure to add it to provideThemes()`);
      value = null;
    }

    if (value) {
      value = createCssThemeName(value);
    }

    this._altTheme.set(value);
  }
  readonly _altTheme = signal<string | null>(null);

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

  syncWithProvider(provider: ProvideThemeDirective) {
    this._currentProviderSync?.destroy();

    runInInjectionContext(this._injector, () => {
      this._currentProviderSync = effect(() => {
        this.theme = provider._theme();
        this.altTheme = provider._altTheme();
      });
    });
  }

  stopSyncWithProvider() {
    this._currentProviderSync?.destroy();
    this._currentProviderSync = null;
  }
}
