import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const injectRouterNavigationState = <T>() => {
  const router = inject(Router);

  const navState = router.getCurrentNavigation()?.extras.state;

  return (navState || null) as T | null;
};
