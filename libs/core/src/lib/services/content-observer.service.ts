/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { coerceElement } from '@angular/cdk/coercion';
import { ElementRef, Injectable, OnDestroy, inject } from '@angular/core';
import { Observable, Observer, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MutationObserverFactory {
  create(callback: MutationCallback): MutationObserver | null {
    return typeof MutationObserver === 'undefined' ? null : new MutationObserver(callback);
  }
}

@Injectable({ providedIn: 'root' })
export class ContentObserverService implements OnDestroy {
  private _mutationObserverFactory = inject(MutationObserverFactory);

  private _observedElements = new Map<
    Element,
    {
      observer: MutationObserver | null;
      readonly stream: Subject<MutationRecord[]>;
      count: number;
    }
  >();

  ngOnDestroy() {
    this._observedElements.forEach((_, element) => this._cleanupObserver(element));
  }

  observe(element: Element): Observable<MutationRecord[]>;
  observe(element: ElementRef<Element>): Observable<MutationRecord[]>;
  observe(elementOrRef: Element | ElementRef<Element>): Observable<MutationRecord[]> {
    const element = coerceElement(elementOrRef);

    return new Observable((observer: Observer<MutationRecord[]>) => {
      const stream = this._observeElement(element);
      const subscription = stream.subscribe(observer);

      return () => {
        subscription.unsubscribe();
        this._unobserveElement(element);
      };
    });
  }

  private _observeElement(element: Element): Subject<MutationRecord[]> {
    if (!this._observedElements.has(element)) {
      const stream = new Subject<MutationRecord[]>();
      const observer = this._mutationObserverFactory.create((mutations) => stream.next(mutations));
      if (observer) {
        observer.observe(element, {
          characterData: true,
          childList: true,
          subtree: true,
        });
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
