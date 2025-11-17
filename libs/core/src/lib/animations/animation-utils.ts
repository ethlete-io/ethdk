import { Observable } from 'rxjs';

export const nextFrame = (cb: () => void) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
};

export const fromNextFrame = () => {
  return new Observable<void>((observer) => {
    nextFrame(() => {
      observer.next();
      observer.complete();
    });
  });
};

export const forceReflow = (element: HTMLElement = document.body) => {
  return element.offsetHeight;
};
