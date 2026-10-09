import { computed } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { CheckoutManifests, checkoutDependenciesOf } from '@ethlete/timetrack';
import { catchError, concatMap, map, of } from 'rxjs';
import { injectGitCollector } from '../collectors';
import { injectHostPorts } from '../host';

/**
 * Which discovered checkout uses which as a package, for `buildRows` to name a library's work after
 * the consumer that came next. Each checkout's manifests are read once; a failed read is tried again
 * on the next discovery.
 */
const CHECKOUT_DEPENDENCIES_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const ports = injectHostPorts();
  const git = injectGitCollector();
  const read = new Map<string, CheckoutManifests>();

  const manifests = toSignal(
    toObservable(git.discovery).pipe(
      map((discovery) => discovery?.repos ?? []),
      concatMap((repos) => {
        const missing = repos.filter((repo) => !read.has(repo));
        const fetched$ = missing.length
          ? ports.git.manifests$(missing).pipe(catchError(() => of<CheckoutManifests[]>([])))
          : of<CheckoutManifests[]>([]);

        return fetched$.pipe(
          map((fetched) => {
            for (const entry of fetched) read.set(entry.repo, entry);

            return repos.flatMap((repo) => read.get(repo) ?? []);
          }),
        );
      }),
    ),
    { initialValue: [] },
  );

  return computed(() => checkoutDependenciesOf(manifests()));
});

export const injectCheckoutDependencies = /* @__PURE__ */ toInjectFn(CHECKOUT_DEPENDENCIES_DEF);
