import { Component, ViewEncapsulation, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { map, switchMap, timer } from 'rxjs';
import { IconDirective, PLUS_ICON, provideIcons } from '../../../icon';
import { NavTabLinkComponent } from '../../nav-tabs/nav-tab-link.component';
import { NavTabsComponent } from '../../nav-tabs/nav-tabs.component';

export type NavTabsLayoutShift = 'font-swap' | 'late-icon' | 'hidden-first-frame';

@Component({
  selector: 'et-sb-nav-tabs-layout-shift',
  template: `
    <div
      [attr.data-shifted]="shifted() ? '' : null"
      [style.display]="shift() === 'hidden-first-frame' && !shifted() ? 'none' : null"
      [style.--et-tab-letter-spacing]="shift() === 'font-swap' && shifted() ? '0.2em' : null"
      class="flex flex-col gap-3 p-8 font-sans"
      style="width: 360px"
    >
      <p class="m-0 text-xs">Shift: {{ shift() }} after {{ shiftDelay() }}ms</p>
      <et-nav-tabs>
        @for (link of LINKS; track link.path) {
          <a [et-nav-tab-link]="link.path">
            @if (shift() === 'late-icon' && shifted() && link.icon) {
              <i etIcon="et-plus"></i>
            }
            {{ link.label }}
          </a>
        }
      </et-nav-tabs>
      <router-outlet />
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NavTabsComponent, NavTabLinkComponent, RouterOutlet, IconDirective],
  providers: [provideIcons(PLUS_ICON)],
})
export class NavTabsLayoutShiftStorybookComponent {
  public shift = input<NavTabsLayoutShift>('font-swap');
  public shiftDelay = input(400);

  protected shifted = toSignal(
    toObservable(this.shiftDelay).pipe(switchMap((delay) => timer(delay).pipe(map(() => true)))),
    { initialValue: false },
  );

  protected readonly LINKS = [
    { path: '/overview', label: 'Overview', icon: true },
    { path: '/schedule', label: 'Schedule', icon: true },
    { path: '/teams', label: 'Participating teams', icon: true },
    { path: '/results', label: 'Results' },
    { path: '/one', label: 'Competition suite', icon: true },
    { path: '/media', label: 'Media' },
    { path: '/settings', label: 'Settings' },
    { path: '/archive', label: 'Archive' },
  ];
}
