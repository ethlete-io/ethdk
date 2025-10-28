import { ElementRef, inject } from '@angular/core';
import { signalHostAttributes, signalHostClasses, signalHostStyles } from '../signals';
import { createComponentId } from '../utils';

export const createPropHandlers = () => {
  const id = createComponentId('et-props');

  const elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  const classes = signalHostClasses({});
  const attributes = signalHostAttributes({});
  const styles = signalHostStyles({});

  return {
    classes,
    attributes,
    styles,
    id,
    elementRef,
  };
};

export type PropHandlers = ReturnType<typeof createPropHandlers>;
