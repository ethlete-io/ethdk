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
import {
  createCssSurfaceName,
  injectSurfaceThemes,
  injectSurfaceThemesPrefix,
  SurfaceTheme,
} from './surface-theme.util';

export const SURFACE_PROVIDER = new InjectionToken<ProvideSurfaceDirective>('SurfaceProvider');

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

  surface = input<string | null>(undefined, { alias: 'etProvideSurface' });

  resolvedTheme = computed<SurfaceTheme | null>(() => {
    const value = this.surface();

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
    const value = this.surface();

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
        const provideSurface = provider.surface();

        untracked(() => {
          setInputSignal(this.surface, provideSurface);
        });
      });
    });
  }

  stopSyncWithProvider() {
    this.currentProviderSync?.destroy();
    this.currentProviderSync = null;
  }
}
