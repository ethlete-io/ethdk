import { Injector, runInInjectionContext } from '@angular/core';
import { injectErrorTheme, injectSuccessTheme, injectWarningTheme } from '@ethlete/core';

export type SemanticThemeType = 'success' | 'warning' | 'error';

/**
 * Call only once the type is actually rendered: each inject throws unless the app registered a theme of that
 * type, and an app must not need one for a state it never shows.
 */
export const injectSemanticTheme = (injector: Injector, type: SemanticThemeType) =>
  runInInjectionContext(injector, () => {
    if (type === 'success') return injectSuccessTheme();
    if (type === 'warning') return injectWarningTheme();

    return injectErrorTheme();
  });
