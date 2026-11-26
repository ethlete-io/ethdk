import { Component, ElementRef, ViewEncapsulation, inject } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { FocusRingDirective } from '../../focus-ring';
import { TabBarTriggerDirective } from '../headless/tab-bar-trigger.directive';
import { TabBarUnderlineDirective } from '../headless/tab-bar-underline.directive';
import { NavTabLinkDirective } from './headless/nav-tab-link.directive';
import { mountNavTabLinkStyles } from './nav-tab-link-styles.component';

const NAV_TAB_LINK_ACTIVE_OPTIONS: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

@Component({
  selector: 'a[et-nav-tab-link]',
  template: `<span class="et-nav-tab-link__content"><ng-content /></span><span etTabBarUnderline></span>`,
  encapsulation: ViewEncapsulation.None,
  imports: [TabBarUnderlineDirective],
  hostDirectives: [
    {
      directive: RouterLink,
      inputs: [
        'routerLink:et-nav-tab-link',
        'queryParams',
        'fragment',
        'queryParamsHandling',
        'preserveFragment',
        'skipLocationChange',
        'replaceUrl',
        'state',
        'relativeTo',
      ],
    },
    {
      directive: RouterLinkActive,
      inputs: ['routerLinkActive', 'routerLinkActiveOptions', 'ariaCurrentWhenActive'],
    },
    {
      directive: TabBarTriggerDirective,
      inputs: ['disabled'],
    },
    NavTabLinkDirective,
    FocusRingDirective,
  ],
  host: {
    class: 'et-nav-tab-link',
    '[class.et-nav-tab-link--active]': 'navTabLink.isActive()',
    '[class.et-nav-tab-link--disabled]': 'navTabLink.trigger.disabled()',
    '[attr.href]': 'navTabLink.trigger.disabled() ? null : routerLink.href',
    '(keydown.space)': 'handleSpace($event)',
  },
})
export class NavTabLinkComponent {
  protected navTabLink = inject(NavTabLinkDirective);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected routerLink = inject(RouterLink, { self: true });
  private routerLinkActive = inject(RouterLinkActive, { self: true });

  constructor() {
    this.routerLinkActive.routerLinkActiveOptions = NAV_TAB_LINK_ACTIVE_OPTIONS;
    mountNavTabLinkStyles();
  }

  protected handleSpace(event: Event) {
    event.preventDefault();

    if (this.navTabLink.trigger.disabled()) {
      return;
    }

    this.elementRef.nativeElement.click();
  }
}
