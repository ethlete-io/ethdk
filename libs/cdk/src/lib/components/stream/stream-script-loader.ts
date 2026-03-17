import { DOCUMENT, inject } from '@angular/core';
import { createRootProvider, injectRenderer } from '@ethlete/core';
import { Observable, shareReplay } from 'rxjs';

export const [, injectStreamScriptLoader] = createRootProvider(
  () => {
    const document = inject(DOCUMENT);
    const cache = new Map<string, Observable<void>>();
    const mountedScripts = new Set<string>();
    const renderer = injectRenderer();

    const load = (src: string): Observable<void> => {
      const cached = cache.get(src);

      if (cached) return cached;

      const obs = new Observable<void>((subscriber) => {
        const isMounted = mountedScripts.has(src);

        if (isMounted) {
          subscriber.next();
          subscriber.complete();
          return;
        }

        const script = renderer.createElement('script');
        script.src = src;
        script.async = true;

        renderer.listen(script, 'load', () => {
          subscriber.next();
          subscriber.complete();
          mountedScripts.add(src);
        });

        renderer.listen(script, 'error', () => {
          cache.delete(src);
          script.remove();
          mountedScripts.delete(src);
          subscriber.error(new Error(`Failed to load script: ${src}`));
        });

        renderer.appendChild(document.head, script);
      }).pipe(shareReplay(1));

      cache.set(src, obs);
      return obs;
    };

    return { load };
  },
  { name: 'Stream Script Loader' },
);

export type StreamScriptLoader = ReturnType<typeof injectStreamScriptLoader>;
