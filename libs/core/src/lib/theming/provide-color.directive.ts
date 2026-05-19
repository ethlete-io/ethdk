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
  signal,
  untracked,
} from '@angular/core';
import { ColorTheme, createCssColorThemeName, injectColorThemes, injectColorThemesPrefix } from './color-theme.util';

export const COLOR_PROVIDER = new InjectionToken<ProvideColorDirective>('ColorProvider');

const FORCED_MAIN_COLOR_UNSET = Symbol('FORCED_MAIN_COLOR_UNSET');

type ForcedMainColorState = string | ColorTheme | null | typeof FORCED_MAIN_COLOR_UNSET;

@Directive({
  selector: '[etProvideColor]',
  providers: [{ provide: COLOR_PROVIDER, useExisting: ProvideColorDirective }],
  host: {
    '[class]': 'themeClass()',
  },
})
export class ProvideColorDirective {
  private themes = injectColorThemes({ optional: true });
  private prefix = injectColorThemesPrefix({ optional: true });
  private injector = inject(Injector);

  private currentProviderSync: EffectRef | null = null;
  private forcedMainColor = signal<ForcedMainColorState>(FORCED_MAIN_COLOR_UNSET);

  mainColor = input<string | ColorTheme | null>(undefined, { alias: 'etProvideColor' });

  effectiveMainColor = computed(() => {
    const forcedMainColor = this.forcedMainColor();

    if (forcedMainColor !== FORCED_MAIN_COLOR_UNSET) {
      return forcedMainColor;
    }

    return this.mainColor();
  });

  mainColorName = computed(() => {
    const raw = this.effectiveMainColor();
    const value = typeof raw === 'object' && raw !== null ? raw.name : raw;

    if (!this.themes || !value) return;

    if (isDevMode() && !this.themes.some((theme) => theme.name === value) && value !== null) {
      console.error(`Theme ${value} does not exist. Please make sure to add it to provideColorThemesWithTailwind4()`);
    }

    return createCssColorThemeName(value);
  });

  protected themeClass = computed(() => {
    const prefix = this.prefix || 'et';

    if (this.mainColorName()) {
      return `${prefix}-color--${this.mainColorName()}`;
    }

    return `${prefix}-color--inherited`;
  });

  syncWithProvider(provider: ProvideColorDirective) {
    this.currentProviderSync?.destroy();

    runInInjectionContext(this.injector, () => {
      this.currentProviderSync = effect(() => {
        const provideMainColor = provider.effectiveMainColor();

        untracked(() => {
          if (provideMainColor === undefined) {
            this.clearForcedMainColor();

            return;
          }

          this.forceMainColor(provideMainColor);
        });
      });
    });
  }

  stopSyncWithProvider() {
    const hadProviderSync = !!this.currentProviderSync;

    this.currentProviderSync?.destroy();
    this.currentProviderSync = null;

    if (hadProviderSync) {
      this.clearForcedMainColor();
    }
  }

  /** @internal */
  forceMainColor(color: string | ColorTheme | null) {
    this.forcedMainColor.set(color);
  }

  /** @internal */
  clearForcedMainColor() {
    if (this.forcedMainColor() === FORCED_MAIN_COLOR_UNSET) {
      return;
    }

    this.forcedMainColor.set(FORCED_MAIN_COLOR_UNSET);
  }
}
