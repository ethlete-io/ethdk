import { Component, ViewEncapsulation, input } from '@angular/core';
import { BadgeVariant } from '../badge.component';
import { BADGE_IMPORTS } from '../badge.imports';

@Component({
  selector: 'et-sb-badge',
  template: `
    <div class="flex flex-wrap items-center gap-2 p-8 font-sans">
      <et-badge [variant]="variant()">Default</et-badge>
      <et-badge [variant]="variant()" color="brand">Brand</et-badge>
      <et-badge [variant]="variant()" color="success">Active</et-badge>
      <et-badge [variant]="variant()" color="warning">Pending</et-badge>
      <et-badge [variant]="variant()" color="danger">3 errors</et-badge>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS],
})
export class BadgeStorybookComponent {
  public variant = input<BadgeVariant>('tonal');
}
