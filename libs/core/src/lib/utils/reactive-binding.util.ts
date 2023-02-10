import { ElementRef, inject } from '@angular/core';
import { distinctUntilChanged, Observable, Subscription, takeUntil } from 'rxjs';
import { DestroyService } from '../services';

type AttributeValueBinding = {
  render: boolean;
  value: boolean | string | number;
};

type AttributeRenderBinding = boolean;

export type ReactiveAttributes = {
  attribute: string | string[];
  observable: Observable<AttributeValueBinding | AttributeRenderBinding>;
  elementRef?: ElementRef<HTMLElement>;
};

const isAttributeRenderBinding = (
  value: AttributeValueBinding | AttributeRenderBinding,
): value is AttributeRenderBinding => typeof value === 'boolean';
const isAttributeValueBinding = (
  value: AttributeValueBinding | AttributeRenderBinding,
): value is AttributeValueBinding => typeof value === 'object';

export interface ReactiveBindingResult {
  reset: () => void;
  remove: (...attributes: string[]) => void;
  push: (value: ReactiveAttributes) => void;
}

export const createReactiveBindings = (...values: ReactiveAttributes[]): ReactiveBindingResult => {
  const rootElementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  const destroy$ = inject(DestroyService, { host: true }).destroy$;

  const subscriptions: { attributes: string[]; subscription: Subscription }[] = [];
  const pushedAttributes: string[][] = [];

  const defaults: Record<string, string | undefined> = {};

  const push = (value: ReactiveAttributes) => {
    const { attribute, observable, elementRef } = value;
    const elRef = elementRef || rootElementRef;
    const attributes = Array.isArray(attribute) ? attribute : [attribute];
    pushedAttributes.push(attributes);

    for (const attribute of attributes) {
      if (!defaults[attribute]) {
        defaults[attribute] = elRef.nativeElement.getAttribute(attribute) || undefined;
      }
    }

    const subscription = observable
      .pipe(
        takeUntil(destroy$),
        distinctUntilChanged((a, b) => {
          if (isAttributeRenderBinding(a) && isAttributeRenderBinding(b)) {
            return a === b;
          } else if (isAttributeValueBinding(a) && isAttributeValueBinding(b)) {
            return a.render === b.render && a.value === b.value;
          }

          return false;
        }),
      )
      .subscribe((value) => {
        const currentAttributes = pushedAttributes.find((s) => s.some((current) => attributes.includes(current))) || [];

        for (const attribute of currentAttributes) {
          const isSingleClassMutation = attribute.startsWith('class.');
          const isMultipleClassMutation = attribute === 'class';

          const render = isAttributeRenderBinding(value) ? value : value.render;

          if (isSingleClassMutation) {
            const className = attribute.replace('class.', '');

            if (!className) {
              continue;
            }

            if (!render) {
              elRef.nativeElement.classList.remove(className);
            } else {
              elRef.nativeElement.classList.add(className);
            }
          } else if (isMultipleClassMutation) {
            const classes = isAttributeRenderBinding(value) ? '' : `${value.value}`;

            if (!classes) {
              continue;
            }

            if (!render) {
              elRef.nativeElement.classList.remove(...classes.split(' '));
            } else {
              elRef.nativeElement.classList.add(...classes.split(' '));
            }
          } else {
            const attributeValue = isAttributeRenderBinding(value) ? true : `${value.value}`;

            if (!attribute) {
              continue;
            }

            if (!render) {
              elRef.nativeElement.removeAttribute(attribute);
            } else {
              elRef.nativeElement.setAttribute(attribute, `${attributeValue}`);
            }
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
        rootElementRef.nativeElement.removeAttribute(attribute);
      } else {
        rootElementRef.nativeElement.setAttribute(attribute, defaults[attribute] as string);
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
