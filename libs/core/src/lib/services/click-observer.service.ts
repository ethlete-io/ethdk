/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { coerceElement } from '@angular/cdk/coercion';
import { ElementRef, Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, Observer, Subject, Subscription, fromEvent } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ClickObserverFactory {
  create() {
    return fromEvent<MouseEvent>(document, 'click');
  }
}

@Injectable({ providedIn: 'root' })
export class ClickObserverService implements OnDestroy {
  private _clickObserverFactory = inject(ClickObserverFactory);

  private _observedElements = new Map<
    Element,
    {
      observer: Subscription | null;
      readonly stream: Subject<MouseEvent>;
      count: number;
    }
  >();

  ngOnDestroy() {
    this._observedElements.forEach((_, element) => this._cleanupObserver(element));
  }

  observe(element: Element): Observable<MouseEvent>;
  observe(element: ElementRef<Element>): Observable<MouseEvent>;
  observe(elementOrRef: Element | ElementRef<Element>): Observable<MouseEvent> {
    const element = coerceElement(elementOrRef);

    return new Observable((observer: Observer<MouseEvent>) => {
      const stream = this._observeElement(element);
      const subscription = stream.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this._unobserveElement(element);
      };
    });
  }

  private _observeElement(element: Element): Subject<MouseEvent> {
    if (!this._observedElements.has(element)) {
      const stream = new Subject<MouseEvent>();
      const observer = this._clickObserverFactory.create();

      const sub = observer.subscribe((event) => stream.next(event));

      this._observedElements.set(element, { observer: sub, stream, count: 1 });
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
        observer.unsubscribe();
      }
      stream.complete();
      this._observedElements.delete(element);
    }
  }
}
