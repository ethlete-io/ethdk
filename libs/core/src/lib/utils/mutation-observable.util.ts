import { Observable } from 'rxjs';

export const createMutationObservable = (config: {
  elements: HTMLElement | HTMLElement[];
  options?: MutationObserverInit & { styleIgnoreList?: string[] };
}) => {
  const elements = Array.isArray(config.elements) ? config.elements : [config.elements];

  return new Observable<MutationRecord[]>((obs) => {
    const observer = new MutationObserver((mutations) => {
      if (config.options?.styleIgnoreList) {
        const allowedMutations: MutationRecord[] = [];

        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            const attributeName = mutation.attributeName;

            if (!attributeName || attributeName !== 'style') continue;

            const oldValue = mutation.oldValue;
            const newValue = (mutation.target as HTMLElement).getAttribute('style');

            const oldValueStyles = oldValue?.split(';').map((s) => s.trim()) ?? [];
            const newValueStyles = newValue?.split(';').map((s) => s.trim()) ?? [];

            const changedStyles = newValueStyles.filter((s) => !oldValueStyles.includes(s));

            if (
              changedStyles.some((s) => {
                const [key] = s.split(':');

                if (!key) return false;

                return config.options?.styleIgnoreList?.includes(key);
              })
            )
              continue;

            allowedMutations.push(mutation);
          }
        }

        if (allowedMutations.length) {
          obs.next(allowedMutations);
        }
      } else {
        obs.next(mutations);
      }
    });

    for (const element of elements) {
      observer.observe(element, config.options);
    }

    return () => observer.disconnect();
  });
};
