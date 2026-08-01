import { Directive, ElementRef, Signal, computed, inject, isSignal, model, signal } from '@angular/core';
import { MaybeSignal } from '../signals';
import { signalElementIntersection } from '../signals/element-intersection';

@Directive({
  selector: '[etScrollObserver]',
  exportAs: 'etScrollObserver',
})
export class ScrollObserverDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  enabled = model<MaybeSignal<boolean>>(true);

  private enabledValue = computed(() => {
    const enabled = this.enabled();

    if (isSignal(enabled)) return enabled();

    return enabled;
  });

  private _startEl = signal<ElementRef<HTMLElement> | null>(null);
  private _endEl = signal<ElementRef<HTMLElement> | null>(null);

  private _startIntersection = signalElementIntersection(this._startEl as Signal<ElementRef<HTMLElement> | null>, {
    root: this.elementRef,
    enabled: this.enabledValue,
  });
  private _endIntersection = signalElementIntersection(this._endEl as Signal<ElementRef<HTMLElement> | null>, {
    root: this.elementRef,
    enabled: this.enabledValue,
  });

  isAtStart = computed(() => this._startIntersection()[0]?.isIntersecting ?? false);
  isAtEnd = computed(() => this._endIntersection()[0]?.isIntersecting ?? false);

  _registerStart(el: ElementRef<HTMLElement>) {
    this._startEl.set(el);
  }

  _registerEnd(el: ElementRef<HTMLElement>) {
    this._endEl.set(el);
  }
}
