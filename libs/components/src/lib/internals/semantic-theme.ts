import { injectSemanticColorTheme } from '@ethlete/core';

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
