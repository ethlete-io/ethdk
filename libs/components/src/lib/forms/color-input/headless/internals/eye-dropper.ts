import { EMPTY, Observable, catchError, defer, from, map } from 'rxjs';

type EyeDropperHandle = {
  open: () => Promise<{ sRGBHex: string }>;
};

type EyeDropperCapableWindow = Window & {
  EyeDropper?: new () => EyeDropperHandle;
};

const eyeDropperWindow = (documentRef: Document) => documentRef.defaultView as EyeDropperCapableWindow | null;

export const isEyeDropperSupported = (documentRef: Document) => !!eyeDropperWindow(documentRef)?.EyeDropper;

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
