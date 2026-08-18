import { EMPTY, Observable, catchError, defer, from, map } from 'rxjs';

type EyeDropperHandle = {
  open: () => Promise<{ sRGBHex: string }>;
};

type EyeDropperCapableWindow = Window & {
  EyeDropper?: new () => EyeDropperHandle;
};

const eyeDropperWindow = (documentRef: Document) => documentRef.defaultView as EyeDropperCapableWindow | null;

/** Whether this browser can sample a color off the screen. Chromium only at the time of writing. */
export const isEyeDropperSupported = (documentRef: Document) => !!eyeDropperWindow(documentRef)?.EyeDropper;

/**
 * Samples one color off the screen, as `#rrggbb`. Completes without a value when the browser cannot
 * do it, and when the user dismisses the sampler - a cancel is not an error to report.
 */
export const eyeDropperColor = (documentRef: Document): Observable<string> =>
  defer(() => {
    const EyeDropper = eyeDropperWindow(documentRef)?.EyeDropper;

    if (!EyeDropper) {
      return EMPTY;
    }

    return from(new EyeDropper().open()).pipe(
      map((result) => result.sRGBHex),
      catchError(() => EMPTY),
    );
  });
