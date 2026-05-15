import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GRID_2X2_ICON, IconDirective, PENCIL_ICON, PLUS_ICON, provideIcons } from '../../../icon';
import { NavTabLinkComponent } from '../../nav-tabs/nav-tab-link.component';
import { NavTabsComponent } from '../../nav-tabs/nav-tabs.component';
import { TAB_SIZES } from '../../tab-sizes';

const SIZES = Object.values(TAB_SIZES);

@Component({
  selector: 'et-sb-nav-tabs',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      @for (size of SIZES; track size) {
        <div class="flex flex-col gap-3">
          <p class="m-0 text-xs font-semibold uppercase tracking-widest">{{ size }}</p>
          <et-nav-tabs
            [orientation]="orientation()"
            [fit]="fit()"
            [divider]="divider()"
            [size]="size"
            [color]="color()"
            [variant]="variant()"
          >
            <a [disabled]="disabled()" et-nav-tab-link="/one"><i etIcon="et-grid-2x2"></i> One</a>
            <a [disabled]="disabled()" et-nav-tab-link="/two"><i etIcon="et-pencil"></i> Two</a>
            <a [disabled]="disabled()" et-nav-tab-link="/three"><i etIcon="et-plus"></i> Three</a>
            <a [disabled]="disabled()" et-nav-tab-link="/four">Four</a>
          </et-nav-tabs>
        </div>
      }
      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NavTabsComponent, NavTabLinkComponent, RouterOutlet, IconDirective],
  providers: [provideIcons(GRID_2X2_ICON, PENCIL_ICON, PLUS_ICON)],
})
export class NavTabsStorybookComponent {
  orientation = input<'horizontal' | 'vertical'>('horizontal');
  variant = input<'primary' | 'secondary'>('secondary');
  fit = input<'content' | 'fill'>('content');
  divider = input(true);
  disabled = input(false);
  color = input<string | null>('brand');
  readonly SIZES = SIZES;
}
