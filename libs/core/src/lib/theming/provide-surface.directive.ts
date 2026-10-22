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
  Signal,
  untracked,
} from '@angular/core';
import {
  createCssColorThemeName,
  injectColorThemes,
  injectColorThemesPrefix,
  resolveColorThemeVariant,
} from './color-theme.util';
import { COLOR_PROVIDER } from './provide-color.directive';
import { injectRootSurfaceTheme } from './color-scheme';
import { COLOR_SCHEME_TYPE } from './color-scheme-type.token';
import { injectHostElement } from '../utils';
import {
  createCssSurfaceName,
  injectSurfaceThemes,
  injectSurfaceThemesPrefix,
  RegisteredSurfaceThemeName,
  SurfaceTheme,
} from './surface-theme.util';

export const SURFACE_PROVIDER = new InjectionToken<ProvideSurfaceDirective>('SurfaceProvider');

const FORCED_SURFACE_UNSET = /* @__PURE__ */ Symbol('FORCED_SURFACE_UNSET');

type ForcedSurfaceState = RegisteredSurfaceThemeName | null | typeof FORCED_SURFACE_UNSET;

@Directive({
  selector: '[etProvideSurface]',
  providers: [{ provide: SURFACE_PROVIDER, useExisting: ProvideSurfaceDirective }],
  host: {
    '[class]': 'surfaceClass()',
  },
})
export class ProvideSurfaceDirective {
  private themes = injectSurfaceThemes({ optional: true });
  private prefix = injectSurfaceThemesPrefix({ optional: true });
  private injector = inject(Injector);
  private parentProvider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  private hostElement = injectHostElement();
  private rootTheme = injectRootSurfaceTheme();
  private hasColorScheme = !!inject(COLOR_SCHEME_TYPE, { optional: true });
  private colorThemes = injectColorThemes({ optional: true });
  private colorPrefix = injectColorThemesPrefix({ optional: true });
  private colorProvider = inject(COLOR_PROVIDER, { optional: true });
  private ownColorProvider = inject(COLOR_PROVIDER, { optional: true, self: true });

  private currentProviderSync: EffectRef | null = null;
  private forcedSurface = signal<ForcedSurfaceState>(FORCED_SURFACE_UNSET);

  surface: InputSignal<RegisteredSurfaceThemeName | null | undefined> = input<RegisteredSurfaceThemeName | null>(
    undefined,
    { alias: 'etProvideSurface' },
  );

  effectiveSurface = computed(() => {
    const forcedSurface = this.forcedSurface();

    if (forcedSurface !== FORCED_SURFACE_UNSET) {
      return forcedSurface;
    }

    return this.surface();
  });

  resolvedTheme = computed<SurfaceTheme | null>(() => {
    const value = this.effectiveSurface();

    if (!this.themes) return null;

    // Only the outermost provider adopts the app default. A nested one left unset must keep
    // resolving to `null` so it reports the surface it inherits instead of resetting elevation.
    if (!value) return this.parentProvider ? null : this.rootTheme();

    const theme = this.themes.find((t) => t.name === value) ?? null;

    if (isDevMode() && !theme) {
      console.error(
        `Surface theme ${value} does not exist. Please make sure to add it to provideSurfaceThemesWithTailwind4()`,
      );
    }

    return theme;
  });

  /**
   * The surface theme in effect on this element - the theme this provider resolves itself, or,
   * where it is left unset, the one it inherits from the closest ancestor provider. The outermost
   * provider resolves the app default, so the chain ends there.
   */
  activeTheme: Signal<SurfaceTheme | null> = computed(
    () => this.resolvedTheme() ?? this.parentProvider?.activeTheme() ?? null,
  );

  elevation = computed(() => this.activeTheme()?.elevation ?? 0);

  surfaceType = computed(() => this.activeTheme()?.type ?? null);

  surfaceName = computed(() => {
    const value = this.effectiveSurface();

    if (!this.themes || !value) return;

    return createCssSurfaceName(value);
  });

  private inheritedSurfaceTheme() {
    if (this.parentProvider) return this.parentProvider.activeTheme();

    return this.hasColorScheme ? this.rootTheme() : null;
  }

  private colorThemeClass = computed(() => {
    const own = this.ownColorProvider?.effectiveColor();

    if (typeof own === 'object' && own !== null ? own.name : own) return null;

    const resolved = this.colorProvider?.resolvedColor();
    const chosen =
      (typeof resolved === 'object' && resolved !== null ? resolved.name : resolved) ||
      this.colorThemes?.find((theme) => theme.isDefault)?.name;

    if (!chosen) return null;

    const variant = resolveColorThemeVariant(this.activeTheme(), chosen, this.colorThemes);

    // An overlay pane's DI parent surface is not its DOM ancestor, so the pane cannot inherit the parent's class.
    const inheritsFromParent = !this.parentProvider || this.parentProvider.hostElement.contains(this.hostElement);

    if (
      inheritsFromParent &&
      variant === resolveColorThemeVariant(this.inheritedSurfaceTheme(), chosen, this.colorThemes)
    ) {
      return null;
    }

    if (isDevMode() && !this.colorThemes?.some((theme) => theme.name === variant)) {
      console.error(
        `Surface theme ${this.activeTheme()?.name} names the color theme ${variant}, which does not exist. Please make sure to add it to provideColorThemesWithTailwind4()`,
      );
    }

    return `${this.colorPrefix || 'et'}-color--${createCssColorThemeName(variant)}`;
  });

  protected surfaceClass = computed(() => {
    const prefix = this.prefix || 'et';
    const surfaceClass = this.surfaceName()
      ? `${prefix}-surface--${this.surfaceName()}`
      : `${prefix}-surface--inherited`;
    const colorThemeClass = this.colorThemeClass();

    return colorThemeClass ? `${surfaceClass} ${colorThemeClass}` : surfaceClass;
  });

  syncWithProvider(provider: ProvideSurfaceDirective) {
    this.currentProviderSync?.destroy();

    runInInjectionContext(this.injector, () => {
      this.currentProviderSync = effect(() => {
        const provideSurface = provider.activeTheme()?.name;

        untracked(() => {
          if (provideSurface === undefined) {
            this.clearForcedSurface();

            return;
          }

          this.forceSurface(provideSurface);
        });
      });
    });
  }

  stopSyncWithProvider() {
    const hadProviderSync = !!this.currentProviderSync;

    this.currentProviderSync?.destroy();
    this.currentProviderSync = null;

    if (hadProviderSync) {
      this.clearForcedSurface();
    }
  }

  forceSurface(surface: RegisteredSurfaceThemeName | null) {
    this.forcedSurface.set(surface);
  }

  clearForcedSurface() {
    if (this.forcedSurface() === FORCED_SURFACE_UNSET) {
      return;
    }

    this.forcedSurface.set(FORCED_SURFACE_UNSET);
  }
}

/**
 * Inject a signal containing the surface type the current subtree renders on - the type of the
 * surrounding surface provider, or of the app's default surface where nothing provides one.
 */
export const injectSurfaceType = () => {
  const provider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  const rootTheme = injectRootSurfaceTheme();

  return computed(() => provider?.surfaceType() ?? rootTheme()?.type ?? null);
};

/**
 * Inject a signal containing the surface theme the current subtree renders on - the theme in
 * effect on the surrounding surface provider, or the app's default surface where nothing provides
 * one. Use it to derive an elevation relative to the surrounding surface.
 *
 * `null` where the app registers no surface themes, or registers a default per surface type
 * without `provideColorScheme()`.
 */
export const injectParentSurface = () => {
  const provider = inject(SURFACE_PROVIDER, { optional: true, skipSelf: true });
  const rootTheme = injectRootSurfaceTheme();

  return computed(() => provider?.activeTheme() ?? rootTheme());
};
