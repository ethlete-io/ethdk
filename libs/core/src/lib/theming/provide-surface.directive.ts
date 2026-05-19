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
import {
  createCssSurfaceName,
  injectSurfaceThemes,
  injectSurfaceThemesPrefix,
  SurfaceTheme,
} from './surface-theme.util';

export const SURFACE_PROVIDER = new InjectionToken<ProvideSurfaceDirective>('SurfaceProvider');

const FORCED_SURFACE_UNSET = Symbol('FORCED_SURFACE_UNSET');

type ForcedSurfaceState = string | null | typeof FORCED_SURFACE_UNSET;

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

  private currentProviderSync: EffectRef | null = null;
  private forcedSurface = signal<ForcedSurfaceState>(FORCED_SURFACE_UNSET);

  surface = input<string | null>(undefined, { alias: 'etProvideSurface' });

  effectiveSurface = computed(() => {
    const forcedSurface = this.forcedSurface();

    if (forcedSurface !== FORCED_SURFACE_UNSET) {
      return forcedSurface;
    }

    return this.surface();
  });

  resolvedTheme = computed<SurfaceTheme | null>(() => {
    const value = this.effectiveSurface();

    if (!this.themes || !value) return null;

    const theme = this.themes.find((t) => t.name === value) ?? null;

    if (isDevMode() && !theme && value !== null) {
      console.error(
        `Surface theme ${value} does not exist. Please make sure to add it to provideSurfaceThemesWithTailwind4()`,
      );
    }

    return theme;
  });

  elevation = computed(() => this.resolvedTheme()?.elevation ?? 0);

  surfaceType = computed(() => this.resolvedTheme()?.type ?? null);

  surfaceName = computed(() => {
    const value = this.effectiveSurface();

    if (!this.themes || !value) return;

    return createCssSurfaceName(value);
  });

  protected surfaceClass = computed(() => {
    const prefix = this.prefix || 'et';

    if (this.surfaceName()) {
      return `${prefix}-surface--${this.surfaceName()}`;
    }

    return `${prefix}-surface--inherited`;
  });

  syncWithProvider(provider: ProvideSurfaceDirective) {
    this.currentProviderSync?.destroy();

    runInInjectionContext(this.injector, () => {
      this.currentProviderSync = effect(() => {
        const provideSurface = provider.effectiveSurface();

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

  /** @internal */
  forceSurface(surface: string | null) {
    this.forcedSurface.set(surface);
  }

  /** @internal */
  clearForcedSurface() {
    if (this.forcedSurface() === FORCED_SURFACE_UNSET) {
      return;
    }

    this.forcedSurface.set(FORCED_SURFACE_UNSET);
  }
}
