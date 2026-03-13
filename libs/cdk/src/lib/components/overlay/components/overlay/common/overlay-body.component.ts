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
} from '@angular/core';
import {
  ScrollObserverDirective,
  ScrollObserverEndDirective,
  ScrollObserverStartDirective,
  nextFrame,
  provideBoundaryElement,
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
      <div etScrollObserverStart class="et-overlay-body-start-element"></div>
      <ng-content />
      <div etScrollObserverEnd class="et-overlay-body-end-element"></div>
    </div>
  `,
  imports: [ScrollObserverStartDirective, ScrollObserverEndDirective],
  hostDirectives: [ScrollObserverDirective],
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

  scrollObserver = inject(ScrollObserverDirective);

  dividers = input<OverlayBodyDividerType>(false);

  dividersEnabled = computed(() => this.dividers() === 'dynamic' || this.dividers() === 'static');
  dynamicDividersEnabled = computed(() => this.dividers() === 'dynamic');

  containerScrollState = signalElementScrollState(this.elementRef);

  canScroll = computed(() => this.containerScrollState().canScroll);

  isAtStart = computed(() => {
    if (!this.canScroll()) return true;
    return this.scrollObserver.isAtStart();
  });
  isAtEnd = computed(() => {
    if (!this.canScroll()) return true;
    return this.scrollObserver.isAtEnd();
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
    effect(() => this.scrollObserver.enabled.set(this.dynamicDividersEnabled()));
    nextFrame(() => this.enableDividerAnimations.set(true));
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
