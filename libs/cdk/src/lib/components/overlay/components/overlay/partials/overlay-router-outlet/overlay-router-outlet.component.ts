import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  TemplateRef,
  ViewEncapsulation,
  booleanAttribute,
  computed,
  contentChild,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import {
  AnimatedIfDirective,
  AnimatedLifecycleDirective,
  AnimatedLifecycleState,
  signalHostClasses,
} from '@ethlete/core';
import { OverlayRouterService, SidebarOverlayService } from '../../utils';
import { OverlayMainDirective } from '../overlay-main';
import { OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN } from '../overlay-router-outlet-disabled-template';
import { OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN } from '../overlay-shared-route-template';

export const OVERLAY_ROUTER_OUTLET_TOKEN = new InjectionToken<OverlayRouterOutletComponent>(
  'OVERLAY_ROUTER_OUTLET_TOKEN',
);

@Component({
  selector: 'et-overlay-router-outlet',
  template: `
    <ng-template>
      <ng-content />
    </ng-template>

    <div class="et-overlay-router-outlet">
      @for (page of router.routes(); track page.path) {
        <div
          #pageWrapper
          [class.et-overlay-router-outlet-page--active]="page === router.currentPage()"
          class="et-overlay-router-outlet-page"
          etAnimatedLifecycle
        >
          <ng-container *etAnimatedIf="page === router.currentPage() && !disabled()">
            <ng-container *ngComponentOutlet="page.component; inputs: page.inputs" />
          </ng-container>
        </div>
      }

      @if (outletDisabledTemplate()) {
        <div
          (stateChange)="disabledPageAnimationStateChange($event)"
          class="et-overlay-router-outlet-page et-overlay-router-outlet-page--active"
          etAnimatedLifecycle
        >
          <div *etAnimatedIf="disabled()" [etOverlayMain]="hasSidebar" class="et-overlay-router-outlet-disabled-page">
            <ng-container *ngTemplateOutlet="outletDisabledTemplate()!" />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-overlay-router-outlet-host',
  },
  styleUrl: './overlay-router-outlet.component.scss',
  imports: [AnimatedIfDirective, AnimatedLifecycleDirective, NgComponentOutlet, NgTemplateOutlet, OverlayMainDirective],
  providers: [
    {
      provide: OVERLAY_ROUTER_OUTLET_TOKEN,
      useExisting: OverlayRouterOutletComponent,
    },
  ],
})
export class OverlayRouterOutletComponent {
  readonly hasSidebar = !!inject(SidebarOverlayService, { optional: true });

  router = inject(OverlayRouterService);

  sharedRouteTemplate = contentChild(OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN, { read: TemplateRef });
  outletDisabledTemplate = contentChild(OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN, { read: TemplateRef });

  pageWrappers = viewChildren<ElementRef<HTMLElement>>('pageWrapper');

  disabled = input(false, { transform: booleanAttribute });
  wasDisabled = signal(false);

  // We need to keep track of the disabled state until the exit animation is finished.
  // Otherwise, a wrong animation will be played when the disabled state is toggled off.
  keepDisabledTransition = computed(() => this.wasDisabled() || this.disabled());

  activePageElement = computed(() => {
    const wrappers = this.pageWrappers();
    const currentPage = this.router.currentPage();
    const currentPageIndex = this.router.routes().findIndex((r) => r.path === currentPage?.path);

    return wrappers[currentPageIndex]?.nativeElement ?? null;
  });

  hostClassBindings = signalHostClasses({
    'et-overlay-router-outlet-nav-dir--backward': computed(() => this.router.navigationDirection() === 'backward'),
    'et-overlay-router-outlet-nav-dir--forward': computed(() => this.router.navigationDirection() === 'forward'),
    'et-overlay-router-outlet-transition--slide': computed(
      () => this.router.transitionType() === 'slide' && !this.keepDisabledTransition(),
    ),
    'et-overlay-router-outlet-transition--fade': computed(
      () =>
        this.router.transitionType() === 'fade' ||
        (this.keepDisabledTransition() && this.router.transitionType() !== 'none'),
    ),
    'et-overlay-router-outlet-transition--overlay': computed(
      () => this.router.transitionType() === 'overlay' && !this.keepDisabledTransition(),
    ),
    'et-overlay-router-outlet-transition--vertical': computed(
      () => this.router.transitionType() === 'vertical' && !this.keepDisabledTransition(),
    ),
    'et-overlay-router-outlet-transition--none': computed(() => this.router.transitionType() === 'none'),
    'et-overlay-router-outlet--disabled': this.disabled,
    'et-overlay-router-outlet--has-disabled-template': this.outletDisabledTemplate,
    'et-overlay-router-outlet--has-shared-route-template': this.sharedRouteTemplate,
  });

  scrollActivePageTo(options?: ScrollToOptions | undefined) {
    const activePage = this.activePageElement();

    if (activePage) {
      activePage.scroll(options);
    }
  }

  disabledPageAnimationStateChange(state: AnimatedLifecycleState) {
    if (state === 'entered') {
      this.wasDisabled.set(true);
    } else if (state === 'left') {
      this.wasDisabled.set(false);
    }
  }
}
