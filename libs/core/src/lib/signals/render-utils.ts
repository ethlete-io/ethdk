import { afterNextRender, effect, signal } from '@angular/core';
import { nextFrame } from '../utils';

export const signalIsRendered = () => {
  const isRendered = signal(false);

  afterNextRender(() => isRendered.set(true));

  return isRendered.asReadonly();
};

export const createIsRenderedSignal = () => {
  const value = signal(false);

  nextFrame(() => {
    if (!value()) {
      console.error(
        'Render signal was not set to true. This can cause unexpected behavior. Make sure to .bind() the render signal at the end of the constructor.',
      );
    }
  });

  return {
    state: value,
    bind: () => effect(() => value.set(true)),
  };
};

export const createCanAnimateSignal = () => {
  const value = signal(false);

  nextFrame(() => {
    value.set(true);
  });

  return {
    state: value.asReadonly(),
  };
};
