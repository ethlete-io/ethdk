import { Directive, ElementRef, Signal, computed, inject, model, signal } from '@angular/core';
import { signalElementIntersection } from '../../signals/element-intersection';

@Directive({
  selector: '[etScrollObserver]',
  exportAs: 'etScrollObserver',
})
export class ScrollObserverDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  enabled = model<boolean>(true);

  private _startEl = signal<ElementRef<HTMLElement> | null>(null);
  private _endEl = signal<ElementRef<HTMLElement> | null>(null);

  private _startIntersection = signalElementIntersection(this._startEl as Signal<ElementRef<HTMLElement> | null>, {
    root: this.elementRef,
    enabled: this.enabled,
  });
  private _endIntersection = signalElementIntersection(this._endEl as Signal<ElementRef<HTMLElement> | null>, {
    root: this.elementRef,
    enabled: this.enabled,
  });

  isAtStart = computed(() => this._startIntersection()[0]?.isIntersecting ?? false);
  isAtEnd = computed(() => this._endIntersection()[0]?.isIntersecting ?? false);

  _registerStart(el: ElementRef<HTMLElement>): void {
    this._startEl.set(el);
  }

  _registerEnd(el: ElementRef<HTMLElement>): void {
    this._endEl.set(el);
  }
}
