import { Component, ViewEncapsulation } from '@angular/core';
import { SKELETON_IMPORTS } from '@ethlete/components';

@Component({
  selector: 'app-skeleton',
  template: '<et-skeleton data-testid="skeleton"><et-skeleton-item /><et-skeleton-text /></et-skeleton>',
  encapsulation: ViewEncapsulation.None,
  imports: [SKELETON_IMPORTS],
})
export class SkeletonRouteComponent {}
