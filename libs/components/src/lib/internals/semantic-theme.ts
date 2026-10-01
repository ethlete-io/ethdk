import { computed, Signal } from '@angular/core';
import { ColorTheme, ColorThemeType, injectColorThemes, injectSemanticColorTheme } from '@ethlete/core';

export type SemanticThemeType = 'success' | 'warning' | 'error';

/**
 * Read a type only once it is actually rendered: a read throws unless the app registered a theme of that type,
 * and an app must not need one for a state it never shows.
 */
export const injectSemanticThemes = (): Record<SemanticThemeType, ReturnType<typeof injectSemanticColorTheme>> => ({
  success: injectSemanticColorTheme('success'),
  warning: injectSemanticColorTheme('warning'),
  error: injectSemanticColorTheme('error'),
});

/** Like `injectSemanticColorTheme`, but `null` instead of a throw when the app registered no theme of that type. */
export const injectOptionalSemanticTheme = (type: ColorThemeType): Signal<ColorTheme | null> => {
  const theme = injectSemanticColorTheme(type);
  const isRegistered = !!injectColorThemes({ optional: true })?.some((t) => t.type === type);

  return computed(() => (isRegistered ? theme() : null));
};
