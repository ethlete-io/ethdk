import {
  Component,
  ElementRef,
  InjectionToken,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  CurrentElementVisibility,
  RootBoundaryDirective,
  isElementVisible,
  nextFrame,
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
  ],
  hostDirectives: [RootBoundaryDirective],
  host: {
    class: 'et-overlay-body',
  },
})
export class OverlayBodyComponent implements OnInit, OnDestroy {
  private _overlayRef = inject(OverlayRef, { optional: true });
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _overlayService = inject(OverlayService);

  @Input({ alias: 'dividers' })
  set __dividers(value: OverlayBodyDividerType) {
    this.dividers.set(value);
  }
  protected readonly dividers = signal<OverlayBodyDividerType>(false);

  @ViewChild('firstElement', { static: true })
  private set _firstElement(e: ElementRef<HTMLElement>) {
    this.firstElement.set(e);
  }
  readonly firstElement = signal<ElementRef<HTMLElement> | null>(null);

  @ViewChild('lastElement', { static: true })
  private set _lastElement(e: ElementRef<HTMLElement>) {
    this.lastElement.set(e);
  }
  readonly lastElement = signal<ElementRef<HTMLElement> | null>(null);

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

  private readonly canScroll = computed(() => this.containerScrollState().canScrollHorizontally);

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
    'et-scrollable-body--is-at-start': this.isAtStart,
    'et-scrollable-body--is-at-end': this.isAtEnd,
  });

  constructor() {
    effect(
      () => {
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
      },
      { allowSignalWrites: true },
    );
  }

  ngOnInit() {
    if (!this._overlayRef) {
      const closestRef = getClosestOverlay(this._elementRef, this._overlayService.openOverlays);

      if (!closestRef) {
        throw Error('No closest ref found');
      }

      this._overlayRef = closestRef;
    }

    this._overlayRef._updateLayout({ hasBody: true });
  }

  ngOnDestroy() {
    this._overlayRef?._updateLayout({ hasBody: false });
  }
}
