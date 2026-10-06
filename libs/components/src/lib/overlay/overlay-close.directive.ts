import { Directive, ElementRef, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { applyHostListener, injectRenderer } from '@ethlete/core';
import { getClosestOverlay, resolveClosestOverlay } from './get-closest-overlay';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

@Directive({
  selector: '[et-overlay-close], [etOverlayClose]',
  exportAs: 'etOverlayClose',
  host: {
    '[attr.aria-label]': 'ariaLabel() || null',
    '[attr.type]': 'type()',
  },
})
export class OverlayCloseDirective implements OnInit {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();
  private renderer = injectRenderer();

  public ariaLabel = input<string>(undefined, { alias: 'aria-label' });
  public type = input<'submit' | 'button' | 'reset'>('button');

  public closeResult = input<unknown>(undefined, { alias: 'etOverlayClose' });
  public closeResultAlt = input<unknown>(undefined, { alias: 'et-overlay-close' });

  private overlayRef = signal<OverlayRef<object, unknown> | null>(inject(OVERLAY_REF, { optional: true }));

  private isBusy = computed(() => this.overlayRef()?.busy() ?? false);

  constructor() {
    applyHostListener('click', () => {
      const overlayRef = this.overlayRef() ?? getClosestOverlay(this.elementRef, this.overlayManager.openOverlays());

      if (overlayRef?.busy()) return;

      overlayRef?.close(this.closeResult() ?? this.closeResultAlt());
    });

    this.syncBusyDisabledState();
  }

  public ngOnInit() {
    this.overlayRef.set(
      resolveClosestOverlay({
        overlayRef: this.overlayRef(),
        element: this.elementRef,
        openOverlays: this.overlayManager.openOverlays(),
      }),
    );
  }

  private syncBusyDisabledState() {
    const element = this.elementRef.nativeElement;
    const attribute = element instanceof HTMLButtonElement ? 'disabled' : 'aria-disabled';
    let ownsAttribute = false;

    effect(() => {
      if (this.isBusy()) {
        if (element.hasAttribute(attribute)) return;

        this.renderer.setAttribute(element, attribute, attribute === 'disabled' ? '' : 'true');
        ownsAttribute = true;
      } else if (ownsAttribute) {
        this.renderer.removeAttribute(element, attribute);
        ownsAttribute = false;
      }
    });
  }
}
