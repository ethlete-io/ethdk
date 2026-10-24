import { AngularRenderer } from '@ethlete/core';
import { EMPTY, finalize, fromEvent, ignoreElements, merge, Observable, tap } from 'rxjs';

export type KeyboardInsetTracking = {
  view: Window;
  renderer: AngularRenderer;
  onInset: (inset: number) => void;
  poll$?: Observable<unknown>;
};

/**
 * Tracks the gap between where `position: fixed; bottom: 0` renders and the top of the soft
 * keyboard. Never emits; subscribing starts the tracking and unsubscribing stops it.
 */
export const observeKeyboardInset = (tracking: KeyboardInsetTracking) =>
  new Observable<never>((subscriber) => {
    const viewport = tracking.view.visualViewport;

    if (!viewport) return;

    return trackKeyboardInset(tracking, viewport).subscribe(subscriber);
  });

const trackKeyboardInset = (
  { view, renderer, onInset, poll$ = EMPTY }: KeyboardInsetTracking,
  viewport: VisualViewport,
) => {
  // In a same-origin iframe (Storybook, docs story embeds) the frame's own visualViewport never
  // reflects the soft keyboard - only the top window's does. Track the top viewport plus the
  // frame's position to compute how much of THIS frame the keyboard covers. A cross-origin
  // parent exposes neither (`frameElement` is null / viewport access throws), so those frames
  // keep the local metrics - the status quo of not seeing the keyboard at all.
  let frameElement: Element | null = null;
  let topViewport: VisualViewport | null = null;

  try {
    // no instanceof here - frameElement belongs to the PARENT document's realm, so it is never
    // an instance of this window's HTMLElement constructor
    frameElement = view.frameElement;
    topViewport = frameElement ? (view.top?.visualViewport ?? null) : null;
  } catch {
    frameElement = null;
    topViewport = null;
  }

  // Where "position: fixed; bottom: 0" actually lands is NOT derivable from window/visualViewport
  // on iOS: with the soft keyboard open (and focus zoom active), WebKit positions fixed elements
  // against an internal rect that tracks the visual viewport and is clamped to the document - its
  // bottom sits well below where `innerHeight` says. Measure it with a zero-size fixed probe
  // instead of assuming layout-viewport math; on engines without the quirk the probe bottom IS
  // `innerHeight`, so this degenerates to the plain `innerHeight - height - offsetTop`.
  const probe = renderer.createElement('div') as HTMLElement;
  renderer.setCssProperties(probe, {
    position: 'fixed',
    'inset-block-end': '0',
    'inline-size': '0',
    'block-size': '0',
    visibility: 'hidden',
  });
  renderer.appendChild(view.document.body, probe);

  let lastApplied = -1;

  const apply = () => {
    const fixedBottom = probe.getBoundingClientRect().bottom;
    let keyboardTop: number;

    if (frameElement && topViewport) {
      const covered = frameElement.getBoundingClientRect().bottom - (topViewport.offsetTop + topViewport.height);
      keyboardTop = view.innerHeight - Math.max(0, covered);
    } else {
      keyboardTop = viewport.offsetTop + viewport.height;
    }

    const inset = Math.max(0, fixedBottom - keyboardTop);

    if (inset === lastApplied) return false;

    lastApplied = inset;
    onInset(inset);

    return true;
  };

  // iOS moves its fixed-position rect ASYNCHRONOUSLY while scrolling with the keyboard open (and
  // fires few or no visualViewport events mid-scroll, including when the scroll itself dismisses
  // the keyboard) - a single synchronous re-measure per event reads a stale probe rect. So each
  // event kicks a rAF loop that keeps re-measuring until the inset has been stable for a few
  // frames, then stops - continuous tracking while anything moves, zero per-frame work at rest.
  let rafId: number | null = null;
  let quietFrames = 0;

  const settle = () => {
    quietFrames = apply() ? 0 : quietFrames + 1;
    // ~30 quiet frames (≈500ms) so the loop outlasts the keyboard show/hide animation - iOS can
    // fire its last viewport event right at the animation's start while the fixed-position rect
    // keeps moving until the end
    rafId = quietFrames < 30 ? view.requestAnimationFrame(settle) : null;
  };

  const kick = () => {
    quietFrames = 0;
    apply();
    rafId ??= view.requestAnimationFrame(settle);
  };

  kick();

  const viewports = topViewport ? [viewport, topViewport] : [viewport];
  // window scroll too: a root scroll pans the keyboard-tracking fixed rect without necessarily
  // firing any visualViewport event (top window as well when embedded in an iframe)
  const scrollTargets: (Window | VisualViewport)[] = [...viewports, view];

  try {
    if (frameElement && view.top) scrollTargets.push(view.top);
  } catch {
    // cross-origin top - its scrolls are invisible to us; the frame keeps local tracking
  }

  const viewportChange$ = merge(
    ...viewports.map((v) => fromEvent(v, 'resize')),
    // These are ancestor viewports/windows (visualViewport, iframe top), not a component-owned
    // scroll container - signalElementScrollState targets a known elementRef and doesn't apply.
    // eslint-disable-next-line ethlete/prefer-scroll-state
    ...scrollTargets.map((t) => fromEvent(t, 'scroll', { passive: true })),
  ).pipe(tap(() => kick()));

  return merge(poll$.pipe(tap(() => apply())), viewportChange$).pipe(
    ignoreElements(),
    finalize(() => {
      if (rafId !== null) view.cancelAnimationFrame(rafId);
      probe.remove();
    }),
  );
};
