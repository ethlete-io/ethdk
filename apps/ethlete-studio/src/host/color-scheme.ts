import { Signal, computed, provideAppInitializer, signal } from '@angular/core';
import { injectObserveMediaQuery } from '@ethlete/core';

const prefersDark = signal<Signal<boolean> | null>(null);

/** Makes `preferredScheme` follow `dark`. */
export const followScheme = (dark: Signal<boolean>) => prefersDark.set(dark);

/** The colour scheme this window prefers, which every live frame draws in; `null` until the app follows one. */
export const preferredScheme = computed(() => {
  const dark = prefersDark()?.();

  if (dark === undefined) return null;

  return dark ? 'dark' : 'light';
});

/** Makes `preferredScheme` follow the window's `prefers-color-scheme`. */
export const providePreferredScheme = () =>
  provideAppInitializer(() => followScheme(injectObserveMediaQuery('(prefers-color-scheme: dark)')));
