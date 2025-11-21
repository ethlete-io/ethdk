import { DOCUMENT, inject, signal } from '@angular/core';
import { createRootProvider } from '../utils/angular/di';

export const [injectFocusVisibleTracker, FOCUS_VISIBLE_TRACKER_TOKEN] = createRootProvider(
  () => {
    const document = inject(DOCUMENT);

    const isFocusVisible = signal(false);
    let hadKeyboardEvent = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Meta' || e.key === 'Alt' || e.key === 'Control') {
        hadKeyboardEvent = true;
        isFocusVisible.set(true);
      }
    };

    const onPointerDown = () => {
      hadKeyboardEvent = false;
      isFocusVisible.set(false);
    };

    const onFocus = () => {
      if (hadKeyboardEvent) {
        isFocusVisible.set(true);
      }
    };

    const onBlur = () => {
      isFocusVisible.set(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    document.addEventListener('focus', onFocus, true);
    document.addEventListener('blur', onBlur, true);

    return {
      isFocusVisible: isFocusVisible.asReadonly(),
    };
  },
  { name: 'Focus Visible Tracker' },
);
