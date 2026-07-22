import {
  Component,
  ElementRef,
  InjectionToken,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  RuntimeError,
  ScrollObserverDirective,
  ScrollObserverEndDirective,
  ScrollObserverStartDirective,
  nextFrame,
  provideBoundaryElement,
  signalElementScrollState,
} from '@ethlete/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { OVERLAY_ERROR_CODES } from './overlay-errors';
import { OVERLAY_MAIN_TOKEN } from './overlay-main.directive';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

export const OVERLAY_BODY_TOKEN = new InjectionToken<OverlayBodyComponent>('OVERLAY_BODY_TOKEN');

export type OverlayBodyDividerType = 'static' | 'dynamic' | false;

@Component({
  selector: '[et-overlay-body], et-overlay-body',
  template: `
    <div class="et-overlay-body-container">
      <div class="et-overlay-body-start-element" etScrollObserverStart></div>
      <ng-content />
      <div class="et-overlay-body-end-element" etScrollObserverEnd></div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollObserverStartDirective, ScrollObserverEndDirective],
  providers: [
    {
      provide: OVERLAY_BODY_TOKEN,
      useExisting: OverlayBodyComponent,
    },
    provideBoundaryElement(),
  ],
  hostDirectives: [ScrollObserverDirective],
  host: {
    class: 'et-overlay-body',
    '[class.et-overlay-body--render-dividers]': 'dividersEnabled()',
    '[class.et-overlay-body--dynamic-dividers]': 'dynamicDividersEnabled()',
    '[class.et-overlay-body--enable-divider-animations]': 'enableDividerAnimations()',
    '[class.et-scrollable-body--can-scroll]': 'canScroll()',
    '[class.et-scrollable-body--is-at-start]': 'this.dynamicDividersEnabled() ? this.isAtStart() : null',
    '[class.et-scrollable-body--is-at-end]': 'this.dynamicDividersEnabled() ? this.isAtEnd() : null',
  },
})
export class OverlayBodyComponent implements OnInit {
  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  private scrollObserver = inject(ScrollObserverDirective);
  private overlayManager = injectOverlayManager();
  private overlayMain = inject(OVERLAY_MAIN_TOKEN, { optional: true });

  public dividers = input<OverlayBodyDividerType>(false);

  public dividersEnabled = computed(() => this.dividers() === 'dynamic' || this.dividers() === 'static');
  public dynamicDividersEnabled = computed(() => this.dividers() === 'dynamic');

  public containerScrollState = signalElementScrollState(this.elementRef);

  public canScroll = computed(() => this.containerScrollState().canScroll);

  public isAtStart = computed(() => {
    if (!this.canScroll()) return true;
    return this.scrollObserver.isAtStart();
  });
  public isAtEnd = computed(() => {
    if (!this.canScroll()) return true;
    return this.scrollObserver.isAtEnd();
  });

  public enableDividerAnimations = signal(false);

  constructor() {
    this.scrollObserver.enabled.set(this.dynamicDividersEnabled);

    nextFrame(() => this.enableDividerAnimations.set(true));
  }

  public ngOnInit() {
    if (!this.overlayMain) {
      throw new RuntimeError(
        OVERLAY_ERROR_CODES.MISSING_OVERLAY_MAIN,
        '[OverlayBodyComponent] An overlay body must be used inside an <et-overlay-main> element or a host with the etOverlayMain directive.',
      );
    }

    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });
  }

  public scrollToTop(behavior?: ScrollBehavior) {
    this.elementRef.nativeElement.scrollTo({ top: 0, behavior });
  }
}
