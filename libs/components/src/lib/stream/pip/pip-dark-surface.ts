import { effect, inject, untracked } from '@angular/core';
import { ProvideSurfaceDirective, injectSurfaceThemes, resolveSurfaceByElevation, setInputSignal } from '@ethlete/core';

export const syncPipDarkSurface = () => {
  const provideSurface = inject(ProvideSurfaceDirective);
  const surfaceThemes = injectSurfaceThemes({ optional: true });

  if (!surfaceThemes) return;

  effect(() => {
    const surface = resolveSurfaceByElevation(surfaceThemes, 'dark', 1);

    untracked(() => setInputSignal(provideSurface.surface, surface?.name ?? null));
  });
};
