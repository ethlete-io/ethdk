import { Observable } from 'rxjs';

export const createResizeObservable = (config: {
  elements: HTMLElement | HTMLElement[];
  options?: ResizeObserverOptions;
}) => {
  const elements = Array.isArray(config.elements) ? config.elements : [config.elements];

  return new Observable<ResizeObserverEntry[]>((obs) => {
    const observer = new ResizeObserver((entries) => obs.next(entries));

    for (const element of elements) {
      observer.observe(element, config.options);
    }

    return () => observer.disconnect();
  });
};
