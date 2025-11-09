import {
  Component,
  ElementRef,
  InjectionToken,
  Input,
  OnInit,
  computed,
  effect,
  inject,
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
import { OverlayService } from '../../services';
import { OverlayRef, getClosestOverlay } from '../../utils';

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
  standalone: true,
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
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  @Input({ alias: 'dividers' })
  set __dividers(value: OverlayBodyDividerType) {
    this.dividers.set(value);
  }
  protected readonly dividers = signal<OverlayBodyDividerType>(false);

  readonly firstElement = viewChild<ElementRef<HTMLElement> | null>('firstElement');
  readonly lastElement = viewChild<ElementRef<HTMLElement> | null>('lastElement');

  private readonly _dividersEnabled = computed(() => this.dividers() === 'dynamic' || this.dividers() === 'static');
  private readonly _dynamicDividersEnabled = computed(() => this.dividers() === 'dynamic');

  private readonly containerScrollState = signalElementScrollState(this._elementRef);
  private readonly firstElementIntersection = signalElementIntersection(this.firstElement, {
    root: this._elementRef,
    enabled: this._dynamicDividersEnabled,
  });
  private readonly firstElementVisibility = signal<CurrentElementVisibility | null>(null);
  private readonly lastElementIntersection = signalElementIntersection(this.lastElement, {
    root: this._elementRef,
    enabled: this._dynamicDividersEnabled,
  });
  private readonly lastElementVisibility = signal<CurrentElementVisibility | null>(null);

  private readonly canScroll = computed(() => this.containerScrollState().canScroll);

  private readonly isAtStart = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.firstElementIntersection()[0];

    if (!intersection) {
      return this.firstElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });
  private readonly isAtEnd = computed(() => {
    if (!this.canScroll()) {
      return true;
    }

    const intersection = this.lastElementIntersection()[0];

    if (!intersection) {
      return this.lastElementVisibility()?.inline ?? true;
    }

    return intersection.isIntersecting;
  });

  private readonly enableDividerAnimations = signal(false);

  readonly hostClassBindings = signalHostClasses({
    'et-overlay-body--render-dividers': this._dividersEnabled,
    'et-overlay-body--dynamic-dividers': this._dynamicDividersEnabled,
    'et-overlay-body--enable-divider-animations': this.enableDividerAnimations,

    'et-scrollable-body--can-scroll': this.canScroll,
    'et-scrollable-body--is-at-start': computed(() => (this._dynamicDividersEnabled() ? this.isAtStart() : false)),
    'et-scrollable-body--is-at-end': computed(() => (this._dynamicDividersEnabled() ? this.isAtEnd() : false)),
  });

  constructor() {
    effect(() => {
      const scrollable = this._elementRef.nativeElement;
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
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays());

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }
  }

  scrollToTop(behavior?: ScrollBehavior) {
    this._elementRef.nativeElement.scrollTo({ top: 0, behavior });
  }
}
