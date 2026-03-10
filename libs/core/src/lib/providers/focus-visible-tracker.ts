import { DestroyRef, DOCUMENT, inject, signal } from '@angular/core';
import { createRootProvider } from '../utils/angular/di';

export const [provideFocusVisibleTracker, injectFocusVisibleTracker, FOCUS_VISIBLE_TRACKER_TOKEN] = createRootProvider(
  () => {
    const document = inject(DOCUMENT);
    const destroyRef = inject(DestroyRef);

    const isFocusVisible = signal(false);
    let hadKeyboardEvent = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Meta' || e.key === 'Alt' || e.key === 'Control') {
        hadKeyboardEvent = true;
        queueMicrotask(() => isFocusVisible.set(true));
      }
    };

    const onPointerDown = () => {
      hadKeyboardEvent = false;
      queueMicrotask(() => isFocusVisible.set(false));
    };

    const onFocus = () => {
      if (hadKeyboardEvent) {
        queueMicrotask(() => isFocusVisible.set(true));
      }
    };

    const onBlur = () => {
      queueMicrotask(() => isFocusVisible.set(false));
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('touchstart', onPointerDown, true);
    document.addEventListener('focus', onFocus, true);
    document.addEventListener('blur', onBlur, true);

    destroyRef.onDestroy(() => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('touchstart', onPointerDown, true);
      document.removeEventListener('focus', onFocus, true);
      document.removeEventListener('blur', onBlur, true);
    });

    return {
      isFocusVisible: isFocusVisible.asReadonly(),
    };
  },
  { name: 'Focus Visible Tracker' },
);
