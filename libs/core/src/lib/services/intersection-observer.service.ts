/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { coerceElement } from '@angular/cdk/coercion';
import { ElementRef, Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, Observer, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IntersectionObserverFactory {
  create(callback: IntersectionObserverCallback): IntersectionObserver | null {
    return typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(callback);
  }
}

@Injectable({ providedIn: 'root' })
export class IntersectionObserverService implements OnDestroy {
  private _intersectionObserverFactory = inject(IntersectionObserverFactory);

  private _observedElements = new Map<
    Element,
    {
      observer: IntersectionObserver | null;
      readonly stream: Subject<IntersectionObserverEntry[]>;
      count: number;
    }
  >();

  ngOnDestroy() {
    this._observedElements.forEach((_, element) => this._cleanupObserver(element));
  }

  observe(element: Element): Observable<IntersectionObserverEntry[]>;
  observe(element: ElementRef<Element>): Observable<IntersectionObserverEntry[]>;
  observe(elementOrRef: Element | ElementRef<Element>): Observable<IntersectionObserverEntry[]> {
    const element = coerceElement(elementOrRef);

    return new Observable((observer: Observer<IntersectionObserverEntry[]>) => {
      const stream = this._observeElement(element);
      const subscription = stream.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this._unobserveElement(element);
      };
    });
  }

  private _observeElement(element: Element): Subject<IntersectionObserverEntry[]> {
    if (!this._observedElements.has(element)) {
      const stream = new Subject<IntersectionObserverEntry[]>();
      const observer = this._intersectionObserverFactory.create((mutations) => stream.next(mutations));
      if (observer) {
        observer.observe(element);
      }
      this._observedElements.set(element, { observer, stream, count: 1 });
    } else {
      this._observedElements.get(element)!.count++;
    }
    return this._observedElements.get(element)!.stream;
  }

  private _unobserveElement(element: Element) {
    if (this._observedElements.has(element)) {
      this._observedElements.get(element)!.count--;
      if (!this._observedElements.get(element)!.count) {
        this._cleanupObserver(element);
      }
    }
  }

  private _cleanupObserver(element: Element) {
    if (this._observedElements.has(element)) {
      const { observer, stream } = this._observedElements.get(element)!;
      if (observer) {
        observer.disconnect();
      }
      stream.complete();
      this._observedElements.delete(element);
    }
  }
}
