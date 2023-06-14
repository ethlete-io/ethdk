/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { coerceElement } from '@angular/cdk/coercion';
import { ElementRef, Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, Observer, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ResizeObserverFactory {
  create(callback: ResizeObserverCallback): ResizeObserver | null {
    return typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(callback);
  }
}

@Injectable({ providedIn: 'root' })
export class ResizeObserverService implements OnDestroy {
  private _mutationObserverFactory = inject(ResizeObserverFactory);

  private _observedElements = new Map<
    Element,
    {
      observer: ResizeObserver | null;
      readonly stream: Subject<ResizeObserverEntry[]>;
      count: number;
    }
  >();

  ngOnDestroy() {
    this._observedElements.forEach((_, element) => this._cleanupObserver(element));
  }

  observe(element: Element): Observable<ResizeObserverEntry[]>;
  observe(element: ElementRef<Element>): Observable<ResizeObserverEntry[]>;
  observe(elementOrRef: Element | ElementRef<Element>): Observable<ResizeObserverEntry[]> {
    const element = coerceElement(elementOrRef);

    return new Observable((observer: Observer<ResizeObserverEntry[]>) => {
      const stream = this._observeElement(element);
      const subscription = stream.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this._unobserveElement(element);
      };
    });
  }

  private _observeElement(element: Element): Subject<ResizeObserverEntry[]> {
    if (!this._observedElements.has(element)) {
      const stream = new Subject<ResizeObserverEntry[]>();
      const observer = this._mutationObserverFactory.create((resizes) => stream.next(resizes));
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
