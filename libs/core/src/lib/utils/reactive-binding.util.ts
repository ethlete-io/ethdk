import { ElementRef, inject } from '@angular/core';
import { distinctUntilChanged, Observable, Subscription, takeUntil } from 'rxjs';
import { DestroyService } from '../services';

export type ReactiveAttributes = {
  attribute: string | string[];
  observable: Observable<{
    render: boolean;
    value: boolean | string | number;
  }>;
};

export interface ReactiveBindingResult {
  reset: () => void;
  remove: (...attributes: string[]) => void;
  push: (value: ReactiveAttributes) => void;
}

export const createReactiveBindings = (...values: ReactiveAttributes[]): ReactiveBindingResult => {
  const elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroy$ = inject<DestroyService>(DestroyService).destroy$;

  const subscriptions: { attributes: string[]; subscription: Subscription }[] = [];
  const pushedAttributes: string[][] = [];

  const defaults: Record<string, string | undefined> = {};

  const push = (value: ReactiveAttributes) => {
    const { attribute, observable } = value;
    const attributes = Array.isArray(attribute) ? attribute : [attribute];
    pushedAttributes.push(attributes);

    for (const attribute of attributes) {
      if (!defaults[attribute]) {
        defaults[attribute] = elementRef.nativeElement.getAttribute(attribute) || undefined;
      }
    }

    const subscription = observable
      .pipe(
        takeUntil(destroy$),
        distinctUntilChanged((a, b) => a.render === b.render && a.value === b.value),
      )
      .subscribe((value) => {
        const currentAttributes = pushedAttributes.find((s) => s.some((current) => attributes.includes(current))) || [];

        for (const attribute of currentAttributes) {
          if (!value.render) {
            elementRef.nativeElement.removeAttribute(attribute);
          } else {
            elementRef.nativeElement.setAttribute(attribute, `${value.value}`);
          }
        }
      });

    subscriptions.push({ attributes, subscription });
  };

  const remove = (...attributes: string[]) => {
    for (const attribute of attributes) {
      const sub = subscriptions.find((s) => s.attributes.includes(attribute));
      const attributeStack = pushedAttributes.find((a) => a.includes(attribute));

      if (sub) {
        sub.attributes = sub.attributes.filter((a) => a !== attribute);
        attributeStack?.splice(attributeStack.indexOf(attribute), 1);

        if (sub.attributes.length === 0) {
          sub.subscription.unsubscribe();
          subscriptions.splice(subscriptions.indexOf(sub), 1);
        }
      }
    }
  };

  const reset = () => {
    for (const attribute in defaults) {
      if (defaults[attribute] === undefined) {
        elementRef.nativeElement.removeAttribute(attribute);
      } else {
        elementRef.nativeElement.setAttribute(attribute, defaults[attribute] as string);
      }
    }
  };

  for (const value of values) {
    push(value);
  }

  return {
    push,
    remove,
    reset,
  };
};
