import { ElementRef, Signal, effect, inject } from '@angular/core';

export const signalClasses = <T extends Record<string, Signal<unknown>>>(el: HTMLElement, classMap: T) => {
  for (const [classString, signal] of Object.entries(classMap)) {
    const classArray = classString.split(' ');

    if (!classArray.length) {
      continue;
    }

    effect(() => {
      const value = signal();

      if (value) {
        el.classList.add(...classArray);
      } else {
        el.classList.remove(...classArray);
      }
    });
  }
};

export const signalHostClasses = <T extends Record<string, Signal<unknown>>>(classMap: T) => {
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  signalClasses(el, classMap);
};

const ALWAYS_TRUE_ATTRIBUTE_KEYS = ['disabled', 'readonly', 'required', 'checked', 'selected'];

export const signalAttributes = <T extends Record<string, Signal<unknown>>>(el: HTMLElement, attributeMap: T) => {
  for (const [attributeString, signal] of Object.entries(attributeMap)) {
    effect(() => {
      const attributeArray = attributeString.split(' ');

      if (!attributeArray.length) {
        return;
      }

      const value = signal();
      const valueString = `${value}`;

      for (const attr of attributeArray) {
        if (ALWAYS_TRUE_ATTRIBUTE_KEYS.includes(attr)) {
          if (value) {
            el.setAttribute(attr, '');
          } else {
            el.removeAttribute(attr);
          }
        } else {
          el.setAttribute(attr, valueString);
        }
      }
    });
  }
};

export const signalHostAttributes = <T extends Record<string, Signal<unknown>>>(attributeMap: T) => {
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  signalAttributes(el, attributeMap);
};

export const signalStyle = <T extends Record<string, Signal<unknown>>>(el: HTMLElement, styleMap: T) => {
  for (const [styleString, signal] of Object.entries(styleMap)) {
    effect(() => {
      const styleArray = styleString.split(' ');

      if (!styleArray.length) {
        return;
      }

      const value = signal();
      const valueString = `${value}`;

      for (const style of styleArray) {
        el.style.setProperty(style, valueString);
      }
    });
  }
};

export const signalHostStyle = <T extends Record<string, Signal<unknown>>>(styleMap: T) => {
  const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  signalStyle(el, styleMap);
};
