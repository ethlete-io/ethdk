import {
  computed,
  Directive,
  effect,
  EffectRef,
  inject,
  InjectionToken,
  Injector,
  input,
  InputSignal,
  isDevMode,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
import {
  ColorTheme,
  createCssColorThemeName,
  injectColorThemes,
  injectColorThemesPrefix,
  RegisteredColorThemeName,
} from './color-theme.util';

export const COLOR_PROVIDER = new InjectionToken<ProvideColorDirective>('ColorProvider');

const FORCED_COLOR_UNSET = Symbol('FORCED_COLOR_UNSET');

type ForcedColorState = RegisteredColorThemeName | ColorTheme | null | typeof FORCED_COLOR_UNSET;

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
  private parentProvider = inject(COLOR_PROVIDER, { optional: true, skipSelf: true });

  private currentProviderSync: EffectRef | null = null;
  private forcedColor = signal<ForcedColorState>(FORCED_COLOR_UNSET);

  color: InputSignal<RegisteredColorThemeName | ColorTheme | null | undefined> = input<
    RegisteredColorThemeName | ColorTheme | null
  >(undefined, { alias: 'etProvideColor' });

  effectiveColor = computed(() => {
    const forcedColor = this.forcedColor();

    if (forcedColor !== FORCED_COLOR_UNSET) {
      return forcedColor;
    }

    return this.color();
  });

  /**
   * The color that actually applies at this provider's location: its own effective color, or —
   * when this provider is passive (no input, nothing forced) — the nearest ancestor provider's.
   * Mirrors the CSS cascade, which falls through a provider's `-color--inherited` scope class;
   * consumers that re-apply context across detached DOM (overlay panes) must use this instead
   * of `effectiveColor` or a passive in-between provider (e.g. a form field's) erases the theme.
   */
  resolvedColor = computed((): RegisteredColorThemeName | ColorTheme | null | undefined => {
    const own = this.effectiveColor();
    const ownName = typeof own === 'object' && own !== null ? own.name : own;

    if (ownName) {
      return own;
    }

    return this.parentProvider?.resolvedColor();
  });

  colorName = computed(() => {
    const raw = this.effectiveColor();
    const value = typeof raw === 'object' && raw !== null ? raw.name : raw;

    if (!this.themes || !value) return;

    if (isDevMode() && !this.themes.some((theme) => theme.name === value) && value !== null) {
      console.error(`Theme ${value} does not exist. Please make sure to add it to provideColorThemesWithTailwind4()`);
    }

    return createCssColorThemeName(value);
  });

  protected themeClass = computed(() => {
    const prefix = this.prefix || 'et';

    if (this.colorName()) {
      return `${prefix}-color--${this.colorName()}`;
    }

    return `${prefix}-color--inherited`;
  });

  syncWithProvider(provider: ProvideColorDirective) {
    this.currentProviderSync?.destroy();

    runInInjectionContext(this.injector, () => {
      this.currentProviderSync = effect(() => {
        const provideColor = provider.resolvedColor();

        untracked(() => {
          if (provideColor === undefined) {
            this.clearForcedColor();

            return;
          }

          this.forceColor(provideColor);
        });
      });
    });
  }

  stopSyncWithProvider() {
    const hadProviderSync = !!this.currentProviderSync;

    this.currentProviderSync?.destroy();
    this.currentProviderSync = null;

    if (hadProviderSync) {
      this.clearForcedColor();
    }
  }

  /** @internal */
  forceColor(color: RegisteredColorThemeName | ColorTheme | null) {
    this.forcedColor.set(color);
  }

  /** @internal */
  clearForcedColor() {
    if (this.forcedColor() === FORCED_COLOR_UNSET) {
      return;
    }

    this.forcedColor.set(FORCED_COLOR_UNSET);
  }
}
