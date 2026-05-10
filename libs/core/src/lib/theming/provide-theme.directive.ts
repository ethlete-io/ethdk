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

export const COLOR_PROVIDER = new InjectionToken<ProvideColorDirective>('ColorProvider');

@Directive({
  selector: '[etProvideTheme]',
  providers: [{ provide: COLOR_PROVIDER, useExisting: ProvideColorDirective }],
  host: {
    '[class]': 'themeClass()',
  },
})
export class ProvideColorDirective {
  private themes = injectColorThemes({ optional: true });
  private prefix = injectThemesPrefix({ optional: true });
  private injector = inject(Injector);

  private currentProviderSync: EffectRef | null = null;

  mainColor = input<string | null>(undefined, { alias: 'etProvideTheme' });
  altColor = input<string | null>(undefined, { alias: 'etProvideAltTheme' });

  mainColorName = computed(() => {
    const value = this.mainColor();

    if (!this.themes || !value) return;

    if (isDevMode() && !this.themes?.some((theme) => theme === value) && value !== null) {
      console.error(`Theme ${value} does not exist. Please make sure to add it to provideColorThemes()`);
    }

    return createCssThemeName(value);
  });

  altColorName = computed(() => {
    const value = this.altColor();

    if (!this.themes || !value) return;

    if (isDevMode() && !this.themes?.some((theme) => theme === value) && value !== null) {
      console.warn(`Theme ${value} does not exist. Please make sure to add it to provideColorThemes()`);
    }

    return createCssThemeName(value);
  });

  protected themeClass = computed(() => {
    const themes: string[] = [];
    const prefix = this.prefix || 'et';

    if (this.mainColorName()) {
      themes.push(`${prefix}-theme--${this.mainColorName()}`);
    }

    if (this.altColorName()) {
      themes.push(`${prefix}-theme-alt--${this.altColorName()}`);
    }

    return themes.join(' ');
  });

  syncWithProvider(provider: ProvideColorDirective) {
    this.currentProviderSync?.destroy();

    runInInjectionContext(this.injector, () => {
      this.currentProviderSync = effect(() => {
        const provideMainTheme = provider.mainColor();
        const provideAltTheme = provider.altColor();

        untracked(() => {
          setInputSignal(this.mainColor, provideMainTheme);
          setInputSignal(this.altColor, provideAltTheme);
        });
      });
    });
  }

  stopSyncWithProvider() {
    this.currentProviderSync?.destroy();
    this.currentProviderSync = null;
  }
}
