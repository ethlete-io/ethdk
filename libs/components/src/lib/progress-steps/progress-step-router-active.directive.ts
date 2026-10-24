import { Directive, computed, inject, input, booleanAttribute } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { injectUrl } from '@ethlete/core';
import { ProgressStepComponent } from './progress-step.component';

/**
 * Makes a step written as a `routerLink` the `current` step while its link is active in the router.
 * Opt in per step; a step without it keeps the `state` you set. Set `etProgressStepExact` to match
 * the link's URL exactly instead of any URL beneath it.
 *
 * @example
 * <a [routerLink]="['/checkout/shipping']" etProgressStepRouterActive et-progress-step>Shipping</a>
 */
@Directive({
  selector: '[etProgressStepRouterActive][routerLink]',
})
export class ProgressStepRouterActiveDirective {
  private router = inject(Router);
  private routerLink = inject(RouterLink);
  private step = inject(ProgressStepComponent);
  private url = injectUrl();

  public etProgressStepExact = input(false, { transform: booleanAttribute });

  private active = computed(() => {
    this.url();

    const urlTree = this.routerLink.urlTree;

    if (!urlTree) {
      return false;
    }

    return this.router.isActive(urlTree, {
      paths: this.etProgressStepExact() ? 'exact' : 'subset',
      queryParams: 'ignored',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  });

  constructor() {
    this.step.registerCurrentSource(this.active);
  }
}
