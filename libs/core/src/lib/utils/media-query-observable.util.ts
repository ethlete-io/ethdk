import { map, Observable, Observer, startWith } from 'rxjs';

export const createMediaQueryObservable = (query: string) => {
  const mq = window.matchMedia(query);

  const observable = new Observable((observer: Observer<MediaQueryListEvent>) => {
    const eventHandler = (event: MediaQueryListEvent) => {
      observer.next(event);
    };

    mq.addEventListener('change', eventHandler);

    return () => {
      mq.removeEventListener('change', eventHandler);
    };
  }).pipe(
    startWith(mq),
    map(({ matches }) => ({
      matches,
      query,
    })),
  );

  return observable;
};
