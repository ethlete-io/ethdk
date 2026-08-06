import { Component, ViewEncapsulation, input } from '@angular/core';
import { CHECK_ICON, IconDirective, STAR_ICON, provideIcons } from '../../icon';
import { BadgeIconAlignment, BadgeSize, BadgeVariant } from '../badge.component';
import { BADGE_IMPORTS } from '../badge.imports';

@Component({
  selector: 'et-sb-badge',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div class="flex flex-wrap items-center gap-2">
        <et-badge [variant]="variant()" [size]="size()">Default</et-badge>
        <et-badge [variant]="variant()" [size]="size()" color="brand">Brand</et-badge>
        <et-badge [variant]="variant()" [size]="size()" color="success">Active</et-badge>
        <et-badge [variant]="variant()" [size]="size()" color="warning">Pending</et-badge>
        <et-badge [variant]="variant()" [size]="size()" color="danger">3 errors</et-badge>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <et-badge [variant]="variant()" [size]="size()" [iconAlignment]="iconAlignment()" color="success">
          <i etIcon="et-check"></i>
          Verified
        </et-badge>
        <et-badge [variant]="variant()" [size]="size()" [iconAlignment]="iconAlignment()" color="warning">
          <i etIcon="et-star"></i>
          Featured
        </et-badge>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <et-badge [variant]="variant()" size="sm">sm</et-badge>
        <et-badge [variant]="variant()" size="md">md</et-badge>
        <et-badge [variant]="variant()" size="lg">lg</et-badge>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, IconDirective],
  providers: [provideIcons(CHECK_ICON, STAR_ICON)],
})
export class BadgeStorybookComponent {
  public variant = input<BadgeVariant>('tonal');
  public size = input<BadgeSize>('md');
  public iconAlignment = input<BadgeIconAlignment>('start');
}
