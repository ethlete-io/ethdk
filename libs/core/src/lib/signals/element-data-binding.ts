import {
  effect,
  EffectRef,
  ElementRef,
  inject,
  Injector,
  Renderer2,
  RendererStyleFlags2,
  runInInjectionContext,
  Signal,
  untracked,
} from '@angular/core';
import { buildElementSignal, SignalElementBindingType } from './element';

export interface BuildSignalEffectsConfig<T extends Record<string, Signal<unknown>>> {
  /** The tokens to apply and their signal value  */
  tokenMap: T;

  /** This function will be invoked for elements that were removed from the signal effects */
  cleanupFn: (el: HTMLElement, tokens: string[]) => void;

  /** This function will be invoked for elements that were added to the signal effects or when their signal value changes */
  updateFn: (el: HTMLElement, tokens: string[], conditionResult: unknown) => void;
}

export const buildSignalEffects = <T extends Record<string, Signal<unknown>>>(
  el: SignalElementBindingType,
  config: BuildSignalEffectsConfig<T>,
) => {
  const elements = buildElementSignal(el);
  const injector = inject(Injector);

  effect(() => {
    const { currentElements, previousElements } = elements();

    for (const previousEl of previousElements) {
      if (currentElements.includes(previousEl)) continue;

      const tokens = Object.keys(config.tokenMap)
        .map((key) => key.split(' '))
        .flat();

      if (!tokens.length) continue;

      config.cleanupFn(previousEl, tokens);
    }

    for (const currentEl of currentElements) {
      if (previousElements.includes(currentEl)) continue;

      for (const [tokens, condition] of Object.entries(config.tokenMap)) {
        untracked(() => {
          const tokenArray = tokens.split(' ');
          if (!tokenArray.length) return;

          config.updateFn(currentEl, tokenArray, condition());
        });
      }
    }
  });

  const effects: Record<string, EffectRef> = {};

  const has = (tokens: string) => tokens in effects;

  const push = (tokens: string, signal: Signal<unknown>) => {
    if (has(tokens)) return;

    runInInjectionContext(injector, () => {
      effects[tokens] = effect(() => {
        const { currentElements } = untracked(() => elements());
        const value = signal();

        for (const el of currentElements) {
          const tokenArray = tokens.split(' ');
          if (!tokenArray.length) continue;

          config.updateFn(el, tokenArray, value);
        }
      });
    });
  };

  const pushMany = (map: Record<string, Signal<unknown>>) => {
    for (const [tokens, signal] of Object.entries(map)) {
      push(tokens, signal);
    }
  };

  const remove = (tokens: string) => {
    effects[tokens]?.destroy();

    delete effects[tokens];

    for (const el of elements().currentElements) {
      const tokenArray = tokens.split(' ');
      if (!tokenArray.length) continue;

      config.cleanupFn(el, tokenArray);
    }
  };

  const removeMany = (tokens: string[]) => {
    for (const token of tokens) {
      remove(token);
    }
  };

  pushMany(config.tokenMap);

  return { remove, removeMany, has, push, pushMany };
};

export const signalClasses = <T extends Record<string, Signal<unknown>>>(el: SignalElementBindingType, classMap: T) => {
  const renderer = inject(Renderer2);

  return buildSignalEffects(el, {
    tokenMap: classMap,
    cleanupFn: (el, tokens) => tokens.forEach((token) => renderer.removeClass(el, token)),
    updateFn: (el, tokens, condition) => {
      if (!condition) {
        tokens.forEach((token) => renderer.removeClass(el, token));
      } else {
        tokens.forEach((token) => renderer.addClass(el, token));
      }
    },
  });
};

export const signalHostClasses = <T extends Record<string, Signal<unknown>>>(classMap: T) =>
  signalClasses(inject(ElementRef), classMap);

const ALWAYS_TRUE_ATTRIBUTE_KEYS = ['disabled', 'readonly', 'required', 'checked', 'selected', 'hidden', 'inert'];

export const signalAttributes = <T extends Record<string, Signal<unknown>>>(
  el: SignalElementBindingType,
  attributeMap: T,
) => {
  const renderer = inject(Renderer2);

  return buildSignalEffects(el, {
    tokenMap: attributeMap,
    cleanupFn: (el, tokens) => tokens.forEach((token) => el.removeAttribute(token)),
    updateFn: (el, tokens, condition) => {
      for (const token of tokens) {
        if (ALWAYS_TRUE_ATTRIBUTE_KEYS.includes(token)) {
          if (condition) {
            renderer.setAttribute(el, token, '');
          } else {
            renderer.removeAttribute(el, token);
          }
          continue;
        }

        if (condition === null || condition === undefined) {
          renderer.removeAttribute(el, token);
        } else {
          renderer.setAttribute(el, token, `${condition}`);
        }
      }
    },
  });
};

export const signalHostAttributes = <T extends Record<string, Signal<unknown>>>(attributeMap: T) =>
  signalAttributes(inject(ElementRef), attributeMap);

export const signalStyles = <T extends Record<string, Signal<unknown>>>(el: SignalElementBindingType, styleMap: T) => {
  const renderer = inject(Renderer2);

  return buildSignalEffects(el, {
    tokenMap: styleMap,
    cleanupFn: (el, tokens) => tokens.forEach((token) => renderer.removeStyle(el, token, RendererStyleFlags2.DashCase)),
    updateFn: (el, tokens, condition) => {
      for (const token of tokens) {
        if (condition === null || condition === undefined) {
          renderer.removeStyle(el, token, RendererStyleFlags2.DashCase);
        } else {
          renderer.setStyle(el, token, `${condition}`, RendererStyleFlags2.DashCase);
        }
      }
    },
  });
};

export const signalHostStyles = <T extends Record<string, Signal<unknown>>>(styleMap: T) =>
  signalStyles(inject(ElementRef), styleMap);
