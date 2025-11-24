import {
  Component,
  ElementRef,
  InjectionToken,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  CurrentElementVisibility,
  isElementVisible,
  nextFrame,
  provideBoundaryElement,
  signalElementIntersection,
  signalElementScrollState,
  signalHostClasses,
} from '@ethlete/core';
import { getClosestOverlay } from '../get-closest-overlay';
import { injectOverlayManager } from '../overlay-manager';
import { OverlayRef } from '../overlay-ref';

export const OVERLAY_BODY_TOKEN = new InjectionToken<OverlayBodyComponent>('OVERLAY_BODY_TOKEN');

export type OverlayBodyDividerType = 'static' | 'dynamic' | false;

@Component({
  selector: '[et-overlay-body], et-overlay-body',
  template: `
    <div class="et-overlay-body-container">
      <div #firstElement class="et-overlay-body-start-element"></div>
      <ng-content />
      <div #lastElement class="et-overlay-body-end-element"></div>
    </div>
  `,
  providers: [
    {
      provide: OVERLAY_BODY_TOKEN,
      useExisting: OverlayBodyComponent,
    },
    provideBoundaryElement(),
  ],
  host: {
    class: 'et-overlay-body',
  },
})
export class OverlayBodyComponent implements OnInit {
  private overlayRef = inject(OverlayRef, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();

  dividers = input<OverlayBodyDividerType>(false);

  firstElement = viewChild<ElementRef<HTMLElement> | null>('firstElement');
  lastElement = viewChild<ElementRef<HTMLElement> | null>('lastElement');

  dividersEnabled = computed(() => this.dividers() === 'dynamic' || this.dividers() === 'static');
  dynamicDividersEnabled = computed(() => this.dividers() === 'dynamic');

  containerScrollState = signalElementScrollState(this.elementRef);
  firstElementIntersection = signalElementIntersection(this.firstElement, {
    root: this.elementRef,
    enabled: this.dynamicDividersEnabled,
  });
  firstElementVisibility = signal<CurrentElementVisibility | null>(null);
  lastElementIntersection = signalElementIntersection(this.lastElement, {
    root: this.elementRef,
    enabled: this.dynamicDividersEnabled,
  });
  lastElementVisibility = signal<CurrentElementVisibility | null>(null);

  canScroll = computed(() => this.containerScrollState().canScroll);

  isAtStart = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.firstElementIntersection()[0];

    if (!intersection) {
      return this.firstElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });
  isAtEnd = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.lastElementIntersection()[0];

    if (!intersection) {
      return this.lastElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });

  enableDividerAnimations = signal(false);

  hostClassBindings = signalHostClasses({
    'et-overlay-body--render-dividers': this.dividersEnabled,
    'et-overlay-body--dynamic-dividers': this.dynamicDividersEnabled,
    'et-overlay-body--enable-divider-animations': this.enableDividerAnimations,

    'et-scrollable-body--can-scroll': this.canScroll,
    'et-scrollable-body--is-at-start': computed(() => (this.dynamicDividersEnabled() ? this.isAtStart() : false)),
    'et-scrollable-body--is-at-end': computed(() => (this.dynamicDividersEnabled() ? this.isAtEnd() : false)),
  });

  constructor() {
    effect(() => {
      const scrollable = this.elementRef.nativeElement;
      const firstElement = this.firstElement()?.nativeElement;
      const lastElement = this.lastElement()?.nativeElement;

      if (!scrollable || !firstElement || !lastElement) {
        return;
      }

      this.firstElementVisibility.set(
        isElementVisible({
          container: scrollable,
          element: firstElement,
        }),
      );

      this.lastElementVisibility.set(
        isElementVisible({
          container: scrollable,
          element: lastElement,
        }),
      );

      // We need to wait one frame before enabling animations to prevent a animation from playing during initial render.
      nextFrame(() => this.enableDividerAnimations.set(true));
    });
  }

  ngOnInit() {
    if (!this.overlayRef) {
      const closestRef = getClosestOverlay(this.elementRef, this.overlayManager.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this.overlayRef = closestRef;
    }
  }

  scrollToTop(behavior?: ScrollBehavior) {
    this.elementRef.nativeElement.scrollTo({ top: 0, behavior });
  }
}
