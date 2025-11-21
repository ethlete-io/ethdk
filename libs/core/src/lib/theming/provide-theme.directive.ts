import {
  computed,
  Directive,
  effect,
  EffectRef,
  inject,
  InjectionToken,
  Injector,
  input,
  isDevMode,
  runInInjectionContext,
  untracked,
} from '@angular/core';
import { setInputSignal } from '../utils';
import { createCssThemeName, injectColorThemes, injectThemesPrefix } from './theme.util';

export const THEME_PROVIDER = new InjectionToken<ProvideThemeDirective>('ThemeProvider');

@Directive({
  selector: '[etProvideTheme]',
  providers: [{ provide: THEME_PROVIDER, useExisting: ProvideThemeDirective }],
  host: {
    '[class]': 'themeClass()',
  },
})
export class ProvideThemeDirective {
  private themes = injectColorThemes({ optional: true });
  private prefix = injectThemesPrefix({ optional: true });
  private injector = inject(Injector);

  private currentProviderSync: EffectRef | null = null;

  mainTheme = input<string>(undefined, { alias: 'etProvideTheme' });
  altTheme = input<string>(undefined, { alias: 'etProvideAltTheme' });

  mainThemeName = computed(() => {
    const value = this.mainTheme();

    if (!this.themes || !value) return;

    if (isDevMode() && !this.themes?.some((theme) => theme === value) && value !== null) {
      console.error(`Theme ${value} does not exist. Please make sure to add it to provideColorThemes()`);
    }

    return createCssThemeName(value);
  });

  altThemeName = computed(() => {
    const value = this.altTheme();

    if (!this.themes || !value) return;

    if (isDevMode() && !this.themes?.some((theme) => theme === value) && value !== null) {
      console.warn(`Theme ${value} does not exist. Please make sure to add it to provideColorThemes()`);
    }

    return createCssThemeName(value);
  });

  protected themeClass = computed(() => {
    const themes: string[] = [];
    const prefix = this.prefix || 'et';

    if (this.mainThemeName()) {
      themes.push(`${prefix}-theme--${this.mainThemeName()}`);
    }

    if (this.altThemeName()) {
      themes.push(`${prefix}-theme-alt--${this.altThemeName()}`);
    }

    return themes.join(' ');
  });

  syncWithProvider(provider: ProvideThemeDirective) {
    this.currentProviderSync?.destroy();

    runInInjectionContext(this.injector, () => {
      this.currentProviderSync = effect(() => {
        const provideMainTheme = provider.mainTheme();
        const provideAltTheme = provider.altTheme();

        untracked(() => {
          setInputSignal(this.mainTheme, provideMainTheme);
          setInputSignal(this.altTheme, provideAltTheme);
        });
      });
    });
  }

  stopSyncWithProvider() {
    this.currentProviderSync?.destroy();
    this.currentProviderSync = null;
  }
}
