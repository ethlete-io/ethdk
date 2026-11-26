import { DOCUMENT, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
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
  viewChildren,
} from '@angular/core';
import {
  AnimatedIfDirective,
  AnimatedLifecycleDirective,
  AnimatedLifecycleState,
  applyInitialFocus,
  injectRenderer,
} from '@ethlete/core';
import { OverlayMainDirective } from '../overlay-main.directive';
import { OVERLAY_REF } from '../overlay-ref';
import { injectSidebarOverlay } from '../sidebar/sidebar-overlay';
import { injectOverlayRouter } from './overlay-router';
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

    <div class="et-overlay-router-outlet">
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
  imports: [AnimatedIfDirective, AnimatedLifecycleDirective, NgComponentOutlet, NgTemplateOutlet, OverlayMainDirective],
  providers: [
    {
      provide: OVERLAY_ROUTER_OUTLET_TOKEN,
      useExisting: OverlayRouterOutletComponent,
    },
  ],
  host: {
    class: 'et-overlay-router-outlet-host',
    '[class.et-overlay-router-outlet-nav-dir--backward]': "router.navigationDirection() === 'backward'",
    '[class.et-overlay-router-outlet-nav-dir--forward]': "router.navigationDirection() === 'forward'",
    '[class.et-overlay-router-outlet-transition--slide]': "transitionType() === 'slide'",
    '[class.et-overlay-router-outlet-transition--fade]': "transitionType() === 'fade'",
    '[class.et-overlay-router-outlet-transition--overlay]': "transitionType() === 'overlay'",
    '[class.et-overlay-router-outlet-transition--vertical]': "transitionType() === 'vertical'",
    '[class.et-overlay-router-outlet-transition--none]': "transitionType() === 'none'",
    '[class.et-overlay-router-outlet--disabled]': 'disabled()',
    '[class.et-overlay-router-outlet--has-disabled-template]': '!!outletDisabledTemplate()',
    '[class.et-overlay-router-outlet--has-shared-route-template]': '!!sharedRouteTemplate()',
  },
})
export class OverlayRouterOutletComponent {
  private injector = inject(Injector);
  private overlayRef = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private document = inject(DOCUMENT);
  protected router = injectOverlayRouter();
  private renderer = injectRenderer();

  public disabled = input(false, { transform: booleanAttribute });

  public sharedRouteTemplate = contentChild(OVERLAY_SHARED_ROUTE_TEMPLATE_TOKEN, { read: TemplateRef });
  public outletDisabledTemplate = contentChild(OVERLAY_ROUTER_OUTLET_DISABLED_TEMPLATE_TOKEN, { read: TemplateRef });

  public pageWrappers = viewChildren<ElementRef<HTMLElement>>('pageWrapper');
  public readonly hasSidebar = !!injectSidebarOverlay({ optional: true });
  public wasDisabled = signal(false);

  public keepDisabledTransition = computed(() => this.wasDisabled() || this.disabled());

  public activePageElement = computed(() => {
    const wrappers = this.pageWrappers();
    const currentPage = this.router.currentPage();
    const currentPageIndex = this.router.routes().findIndex((r) => r.path === currentPage?.path);

    return wrappers[currentPageIndex]?.nativeElement ?? null;
  });

  protected transitionType = computed(() => {
    const type = this.router.transitionType();

    if (type !== 'none' && this.keepDisabledTransition()) {
      return 'fade';
    }

    return type;
  });

  constructor() {
    afterNextRender(() => {
      const paneElement = this.overlayRef?.elements?.paneElement;

      if (!paneElement) return;

      const background = getComputedStyle(paneElement).backgroundColor;

      if (!background || background === 'transparent' || background === 'rgba(0, 0, 0, 0)') return;

      this.renderer.setCssProperty(
        this.elementRef.nativeElement,
        '--_et-overlay-router-outlet-page-background',
        background,
      );
    });

    let isFirstNavigation = true;

    effect(() => {
      this.router.currentPage();

      untracked(() => {
        if (isFirstNavigation) {
          isFirstNavigation = false;

          return;
        }

        afterNextRender(() => this.focusActivePage(), {
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

  /**
   * Moves focus into the freshly navigated page, mirroring the overlay's own open-time focus behaviour
   * (first-tabbable by default, so buttons/inputs win over headings). Falls back to the page wrapper when
   * the page has nothing tabbable. Respects the overlay's `autoFocus` config, including `false`.
   */
  private focusActivePage() {
    const activePage = this.activePageElement();

    if (!activePage) return;

    applyInitialFocus(activePage, this.overlayRef?.config.autoFocus ?? 'first-tabbable', this.document);
  }
}
