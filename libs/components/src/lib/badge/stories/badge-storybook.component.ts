import { Component, ViewEncapsulation, input } from '@angular/core';
import { CARD_IMPORTS } from '../../card';
import { CHECK_ICON, IconDirective, STAR_ICON, provideIcons } from '../../icon';
import { BadgeIconAlignment, BadgeSize, BadgeVariant } from '../badge.component';
import { BADGE_IMPORTS } from '../badge.imports';

@Component({
  selector: 'et-sb-badge',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      @for (surface of surfaces(); track surface) {
        <et-card [surface]="surface">
          <div class="flex flex-col gap-6">
            <div class="flex flex-wrap items-center gap-2">
              <et-badge [variant]="variant()" [size]="size()" [color]="defaultThemeFor(surface)">Default</et-badge>
              <et-badge [variant]="variant()" [size]="size()" [color]="themeFor('brand', surface)">Brand</et-badge>
              <et-badge [variant]="variant()" [size]="size()" [color]="themeFor('success', surface)">Active</et-badge>
              <et-badge [variant]="variant()" [size]="size()" [color]="themeFor('warning', surface)">Pending</et-badge>
              <et-badge [variant]="variant()" [size]="size()" [color]="themeFor('danger', surface)">3 errors</et-badge>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <et-badge
                [variant]="variant()"
                [size]="size()"
                [iconAlignment]="iconAlignment()"
                [color]="themeFor('success', surface)"
              >
                <i etIcon="et-check"></i>
                Verified
              </et-badge>
              <et-badge
                [variant]="variant()"
                [size]="size()"
                [iconAlignment]="iconAlignment()"
                [color]="themeFor('warning', surface)"
              >
                <i etIcon="et-star"></i>
                Featured
              </et-badge>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <et-badge [variant]="variant()" [color]="defaultThemeFor(surface)" size="sm">sm</et-badge>
              <et-badge [variant]="variant()" [color]="defaultThemeFor(surface)" size="md">md</et-badge>
              <et-badge [variant]="variant()" [color]="defaultThemeFor(surface)" size="lg">lg</et-badge>
            </div>
          </div>
        </et-card>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BADGE_IMPORTS, CARD_IMPORTS, IconDirective],
  providers: [provideIcons(CHECK_ICON, STAR_ICON)],
})
export class BadgeStorybookComponent {
  public variant = input<BadgeVariant>('tonal');
  public size = input<BadgeSize>('md');
  public iconAlignment = input<BadgeIconAlignment>('start');
  public surfaces = input<readonly string[]>(['dark', 'light']);

  protected themeFor(name: string, surface: string) {
    return surface === 'light' ? `${name}-on-light` : name;
  }

  protected defaultThemeFor(surface: string) {
    return surface === 'light' ? 'brand-on-light' : undefined;
  }
}
