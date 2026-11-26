import { Provider, ɵEffectScheduler as EffectScheduler, ɵgetInjectableDef as getInjectableDef } from '@angular/core';

export const MAX_EFFECT_RUNS_PER_FLUSH = 100;

type EffectHandle = { run: () => void };

type EffectSchedulerLike = {
  add: (handle: EffectHandle) => void;
  schedule: (handle: EffectHandle) => void;
  remove: (handle: EffectHandle) => void;
  flush: () => void;
};

// Angular's root effect `flush()` loops while any effect is dirty, with no cap: a self-re-dirtying effect
// never returns and the test worker runs out of memory instead of failing.
export const provideEffectLoopGuard = (): Provider => ({
  provide: EffectScheduler,
  useFactory: () => {
    const def = getInjectableDef<EffectSchedulerLike>(EffectScheduler);

    if (!def) throw new Error('Scenario: Angular no longer exposes the effect scheduler factory');

    const inner = def.factory();
    const runs = new Map<EffectHandle, number>();
    const guarded = new WeakSet<EffectHandle>();
    let depth = 0;

    const guard = (handle: EffectHandle) => {
      if (guarded.has(handle)) return;

      guarded.add(handle);

      const run = handle.run.bind(handle);

      handle.run = () => {
        const count = (runs.get(handle) ?? 0) + 1;

        runs.set(handle, count);

        if (count > MAX_EFFECT_RUNS_PER_FLUSH) {
          throw new Error(
            `Scenario: an effect ran more than ${MAX_EFFECT_RUNS_PER_FLUSH} times in one flush - it re-dirties itself in an endless reactive loop`,
          );
        }

        run();
      };
    };

    return {
      add: (handle: EffectHandle) => {
        guard(handle);
        inner.add(handle);
      },
      schedule: (handle: EffectHandle) => inner.schedule(handle),
      remove: (handle: EffectHandle) => inner.remove(handle),
      flush: () => {
        depth++;

        try {
          inner.flush();
        } finally {
          depth--;
          if (depth === 0) runs.clear();
        }
      },
    };
  },
});
