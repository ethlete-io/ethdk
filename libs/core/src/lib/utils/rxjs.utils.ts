/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorSubject, Observer, Subscription } from 'rxjs';

export class BehaviorSubjectWithSubscriberCount<T> extends BehaviorSubject<T> {
  private _subscriberCount = 0;

  get subscriberCount() {
    return this._subscriberCount;
  }

  override subscribe(
    observerOrNext?: Partial<Observer<T>> | ((value: T) => void) | null,
    error?: ((error: any) => void) | null,
    complete?: (() => void) | null,
  ): Subscription;
  override subscribe(
    next?: ((value: T) => void) | null,
    error?: ((error: any) => void) | null,
    complete?: (() => void) | null,
  ): Subscription;
  override subscribe(observerOrNext?: Partial<Observer<T>> | ((value: T) => void) | undefined): Subscription;
  override subscribe(observerOrNext: any) {
    this._subscriberCount++;

    const sub = super.subscribe(observerOrNext);

    return {
      ...sub,
      unsubscribe: () => {
        sub.unsubscribe();
        this._subscriberCount--;
      },
    };
  }

  override unsubscribe() {
    this._subscriberCount--;

    return super.unsubscribe();
  }
}
