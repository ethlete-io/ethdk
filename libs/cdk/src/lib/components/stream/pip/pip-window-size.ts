import { Signal, computed, linkedSignal, signal } from '@angular/core';
import { injectViewportSize } from '@ethlete/core';
import { PipWindowParamsDirective } from './pip-window-params.directive';

export type PipWindowSizeOptions = {
  params: PipWindowParamsDirective;
  titleBarH: Signal<number>;
};

export type PipWindowSize = {
  w: Signal<number | null>;
  h: Signal<number | null>;
  get(): { w: number | null; h: number | null };
  update(fn: (prev: { w: number | null; h: number | null }) => { w: number | null; h: number | null }): void;
  setResize(w: number, h: number): void;
  clearResize(): void;
};

export function createPipWindowSize(options: PipWindowSizeOptions): PipWindowSize {
  const { params, titleBarH } = options;

  const viewportSize = injectViewportSize();
  const resizeState = signal<{ w: number; h: number } | null>(null);

  const size = linkedSignal<
    {
      ratio: number | null;
      vw: number;
      vh: number;
      pad: number;
      minW: number;
      minH: number;
      resize: { w: number; h: number } | null;
    },
    { w: number | null; h: number | null }
  >({
    source: () => ({
      ratio: params.aspectRatio(),
      vw: viewportSize().width,
      vh: viewportSize().height,
      pad: params.viewportPadding(),
      minW: params.minWidth(),
      minH: params.minHeight(),
      resize: resizeState(),
    }),
    computation: ({ ratio, vw, vh, pad, minW, minH, resize }, previous) => {
      if (resize !== null) return { w: resize.w, h: resize.h };
      const prev = previous?.value ?? { w: null, h: null };
      if (prev.w === null) return prev;
      let { w, h } = prev;
      const availW = vw > 0 ? vw - pad * 2 : Infinity;
      const availH = vh > 0 ? vh - pad * 2 : Infinity;
      if (w > availW) w = Math.max(minW, availW);
      if (ratio !== null) {
        h = titleBarH() + w / ratio;
        if (h > availH) {
          const maxContentH = Math.max(0, availH - titleBarH());
          w = Math.max(minW, maxContentH * ratio);
          h = titleBarH() + w / ratio;
        }
      } else if (h !== null && h > availH) {
        h = Math.max(minH, availH);
      }

      return { w, h };
    },
  });

  return {
    w: computed(() => size().w),
    h: computed(() => size().h),
    get: () => size(),
    update: (fn) => size.update(fn),
    setResize: (w, h) => resizeState.set({ w, h }),
    clearResize: () => resizeState.set(null),
  };
}
