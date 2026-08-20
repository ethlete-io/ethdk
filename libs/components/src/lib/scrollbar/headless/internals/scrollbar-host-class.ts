import { AngularRenderer } from '@ethlete/core';

export const SCROLLBAR_HOST_CLASS = 'et-scrollbar-host';

const hostReferences = /* @__PURE__ */ new WeakMap<HTMLElement, number>();

/**
 * Mark a scroll container as owned by a custom scrollbar and return the release function.
 *
 * Ref-counted, because one container carries a scrollbar per axis and the first of the two to be
 * destroyed must not un-mark a container the other still mirrors.
 */
export const markScrollbarHost = (renderer: AngularRenderer, target: HTMLElement) => {
  hostReferences.set(target, (hostReferences.get(target) ?? 0) + 1);
  renderer.addClass(target, SCROLLBAR_HOST_CLASS);

  return () => {
    const remaining = (hostReferences.get(target) ?? 1) - 1;

    if (remaining > 0) {
      hostReferences.set(target, remaining);

      return;
    }

    hostReferences.delete(target);
    renderer.removeClass(target, SCROLLBAR_HOST_CLASS);
  };
};
