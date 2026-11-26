import { inject } from '@angular/core';
import { Router } from '@angular/router';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const injectRouterNavigationState = <T>() => {
  const router = inject(Router);

  const navState = router.getCurrentNavigation()?.extras.state;

  return (navState || null) as T | null;
};
