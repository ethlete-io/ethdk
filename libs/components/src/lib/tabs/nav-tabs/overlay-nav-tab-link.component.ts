import { Component, ElementRef, ViewEncapsulation, inject } from '@angular/core';
import { FocusRingDirective } from '../../focus-ring';
import { OverlayRouterLinkDirective } from '../../overlay/routing/overlay-router-link.directive';
import { TabBarTriggerDirective } from '../headless/tab-bar-trigger.directive';
import { TabBarUnderlineDirective } from '../headless/tab-bar-underline.directive';
import { NavTabLinkDirective } from './headless/nav-tab-link.directive';
import { mountNavTabLinkStyles } from './nav-tab-link-styles.component';

/**
 * A nav tab link that drives an overlay router instead of the Angular router, for tabbed navigation
 * inside an overlay. Takes the target route as its selector input and otherwise behaves like
 * `a[et-nav-tab-link]`.
 *
 * @example
 * <et-nav-tabs orientation="vertical">
 *   <button et-overlay-nav-tab-link="/email">Email</button>
 * </et-nav-tabs>
 */
@Component({
  selector: 'button[et-overlay-nav-tab-link]',
  template: `<span class="et-nav-tab-link__content"><ng-content /></span><span etTabBarUnderline></span>`,
  encapsulation: ViewEncapsulation.None,
  imports: [TabBarUnderlineDirective],
  hostDirectives: [
    {
      directive: OverlayRouterLinkDirective,
      inputs: ['etOverlayRouterLink:et-overlay-nav-tab-link', 'navigationDirection'],
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
    '(keydown.space)': 'handleSpace($event)',
  },
})
export class OverlayNavTabLinkComponent {
  protected navTabLink = inject(NavTabLinkDirective);
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    mountNavTabLinkStyles();
  }

  protected handleSpace(event: Event) {
    event.preventDefault();
    this.elementRef.nativeElement.click();
  }
}
