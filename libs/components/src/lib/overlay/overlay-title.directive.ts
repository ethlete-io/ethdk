import { DestroyRef, Directive, ElementRef, OnInit, inject, input } from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import { resolveClosestOverlay } from './get-closest-overlay';
import { injectOverlayManager } from './overlay-manager';
import { OVERLAY_REF, OverlayRef } from './overlay-ref';

let uniqueId = 0;

const titleIdsByHost = /* @__PURE__ */ new WeakMap<HTMLElement, string[]>();

@Directive({
  selector: '[et-overlay-title], [etOverlayTitle]',
  exportAs: 'etOverlayTitle',
  host: {
    '[attr.id]': 'this.id()',
  },
})
export class OverlayTitleDirective implements OnInit {
  private overlayRef: OverlayRef<object, unknown> | null = inject(OVERLAY_REF, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private overlayManager = injectOverlayManager();
  private renderer = injectRenderer();
  private destroyRef = inject(DestroyRef);

  // eslint-disable-next-line ethlete/no-native-html-input-name -- deliberately drives the host [attr.id] and aria-labelledby
  public id = input(`et-overlay-title-${uniqueId++}`);

  public ngOnInit() {
    this.overlayRef = resolveClosestOverlay({
      overlayRef: this.overlayRef,
      element: this.elementRef,
      openOverlays: this.overlayManager.openOverlays(),
    });

    let isDestroyed = false;
    let registration: { hostElement: HTMLElement; id: string } | null = null;

    this.destroyRef.onDestroy(() => {
      isDestroyed = true;

      if (registration) this.unregister(registration.hostElement, registration.id);
    });

    Promise.resolve().then(() => {
      const overlayRef = this.overlayRef;
      const hostElement = overlayRef?.elements?.hostElement;

      if (isDestroyed || !overlayRef || !hostElement || overlayRef.config.ariaLabel) return;

      registration = { hostElement, id: this.id() };
      titleIdsByHost.set(hostElement, [...(titleIdsByHost.get(hostElement) ?? []), registration.id]);

      if (!hostElement.getAttribute('aria-labelledby')) {
        this.renderer.setAttribute(hostElement, 'aria-labelledby', registration.id);
      }
    });
  }

  private unregister(hostElement: HTMLElement, id: string) {
    const remaining = (titleIdsByHost.get(hostElement) ?? []).filter((titleId) => titleId !== id);

    titleIdsByHost.set(hostElement, remaining);

    if (hostElement.getAttribute('aria-labelledby') !== id) return;

    const next = remaining[0];

    if (next) {
      this.renderer.setAttribute(hostElement, 'aria-labelledby', next);
    } else {
      this.renderer.removeAttribute(hostElement, 'aria-labelledby');
    }
  }
}
