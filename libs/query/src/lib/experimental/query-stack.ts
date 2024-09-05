import { effect, inject, Injector, runInInjectionContext, signal, untracked } from '@angular/core';
import { AnyQuery } from './query';

export const createQueryStack = <T extends AnyQuery>(computation: () => T[]) => {
  const injector = inject(Injector);

  const queries = signal<T[]>([]);

  effect(() => {
    const newQueries = runInInjectionContext(injector, () => computation());

    untracked(() => {
      const oldQueries = queries();

      for (const oldQuery of oldQueries) {
        if (!newQueries.includes(oldQuery)) {
          oldQuery.destroy();
        }
      }

      queries.set(newQueries);
    });
  });

  return queries.asReadonly();
};
