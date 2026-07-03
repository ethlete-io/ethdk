import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  InjectionToken,
  Injector,
  TemplateRef,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  computed,
  contentChild,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  AnimatedIfDirective,
  AnimatedLifecycleDirective,
  AnimatedLifecycleState,
  signalElementDimensions,
  signalHostClasses,
} from '@ethlete/core';
import { OverlayMainDirective } from '../overlay-main.directive';
import { SidebarOverlayService } from '../sidebar/sidebar-overlay';
import { OverlayRouterService } from './overlay-router';
import { OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN } from './overlay-router-outlet-disabled-template.directive';
import { OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN } from './overlay-shared-route-template.directive';

export const OVERLAY_ROUTER_OUTLET_TOKEN = new InjectionToken<OverlayRouterOutletComponent>(
  'OVERLAY_ROUTER_OUTLET_TOKEN',
);

@Component({
  selector: 'et-overlay-router-outlet',
  template: `
    <ng-template>
      <ng-content />
    </ng-template>

    <div [style.block-size.px]="outletHeight()" class="et-overlay-router-outlet">
      @for (page of router.routes(); track page.path) {
        <div
          #pageWrapper
          [class.et-overlay-router-outlet-page--active]="page === router.currentPage()"
          class="et-overlay-router-outlet-page"
          etAnimatedLifecycle
          tabindex="-1"
        >
          <ng-container *etAnimatedIf="page === router.currentPage() && !disabled()">
            <ng-container *ngComponentOutlet="page.component; inputs: page.inputs" />
          </ng-container>
        </div>
      }

      @if (outletDisabledTemplate()) {
        <div
          #disabledPageWrapper
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
  styleUrl: './overlay-router-outlet.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AnimatedIfDirective, AnimatedLifecycleDirective, NgComponentOutlet, NgTemplateOutlet, OverlayMainDirective],
  providers: [
    {
      provide: OVERLAY_ROUTER_OUTLET_TOKEN,
      useExisting: OverlayRouterOutletComponent,
    },
  ],
  host: {
    class: 'et-overlay-router-outlet-host',
  },
})
export class OverlayRouterOutletComponent {
  protected router = inject(OverlayRouterService);
  private injector = inject(Injector);

  public disabled = input(false, { transform: booleanAttribute });

  public sharedRouteTemplate = contentChild(OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN, { read: TemplateRef });
  public outletDisabledTemplate = contentChild(OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN, { read: TemplateRef });

  public pageWrappers = viewChildren<ElementRef<HTMLElement>>('pageWrapper');
  public disabledPageWrapper = viewChild<ElementRef<HTMLElement>>('disabledPageWrapper');
  public readonly hasSidebar = !!inject(SidebarOverlayService, { optional: true });
  public wasDisabled = signal(false);

  // We need to keep track of the disabled state until the exit animation is finished.
  // Otherwise, a wrong animation will be played when the disabled state is toggled off.
  public keepDisabledTransition = computed(() => this.wasDisabled() || this.disabled());

  public activePageElement = computed(() => {
    const wrappers = this.pageWrappers();
    const currentPage = this.router.currentPage();
    const currentPageIndex = this.router.routes().findIndex((r) => r.path === currentPage?.path);

    return wrappers[currentPageIndex]?.nativeElement ?? null;
  });

  // The page currently driving the outlet height: the disabled placeholder while disabled, else the active route.
  private measuredPageElement = computed(() =>
    this.disabled() && this.outletDisabledTemplate()
      ? (this.disabledPageWrapper()?.nativeElement ?? null)
      : this.activePageElement(),
  );

  private pageDimensions = signalElementDimensions(this.measuredPageElement);

  /** Measured height of the visible page — drives the outlet's animated height so it doesn't snap on navigation. */
  protected outletHeight = computed(() => this.pageDimensions().offset?.height ?? null);

  public hostClassBindings = signalHostClasses({
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

  constructor() {
    // Move focus to the newly-activated page so keyboard and screen-reader users follow the flow.
    // The initial page is skipped — the overlay's own autoFocus handles first focus. Focus is applied
    // after the next render so it wins over the browser focusing the link that was just clicked.
    let isFirstNavigation = true;

    effect(() => {
      this.router.currentPage();

      untracked(() => {
        if (isFirstNavigation) {
          isFirstNavigation = false;

          return;
        }

        afterNextRender(() => this.activePageElement()?.focus({ preventScroll: true }), {
          injector: this.injector,
        });
      });
    });
  }

  public scrollActivePageTo(options?: ScrollToOptions | undefined) {
    this.activePageElement()?.scroll(options);
  }

  public disabledPageAnimationStateChange(state: AnimatedLifecycleState) {
    if (state === 'entered') {
      this.wasDisabled.set(true);
    } else if (state === 'left') {
      this.wasDisabled.set(false);
    }
  }
}
