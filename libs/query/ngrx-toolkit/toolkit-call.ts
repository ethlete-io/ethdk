import { assertInInjectionContext, EnvironmentInjector, inject, Injector } from '@angular/core';
import { AnyQueryCreator } from '@ethlete/query';
import { createToolkitHandle, ToolkitHandleEntry, toQueryArgs } from './toolkit-handle';
import { ActionCallArgs, MappedEntityState } from './toolkit-types';

export type ToolkitCallOptions = {
  /**
   * The injector the handle's query lives in. Required outside an injection context, which is where a
   * `providedIn: 'root'` facade calls from; pass the facade's `inject(Injector)`.
   */
  injector?: Injector;
};

type ToolkitRegistry = WeakMap<AnyQueryCreator, Map<string, ToolkitHandleEntry>>;

const registries = /* @__PURE__ */ new WeakMap<EnvironmentInjector, ToolkitRegistry>();

const sortedValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortedValue);
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortedValue((value as Record<string, unknown>)[key])]),
  );
};

const hashArgs = (args: unknown) => JSON.stringify(sortedValue(args ?? null));

const resolveEnvironmentInjector = (fn: (...args: never[]) => unknown, options?: ToolkitCallOptions) => {
  if (options?.injector) return options.injector.get(EnvironmentInjector);

  assertInInjectionContext(fn);

  return inject(EnvironmentInjector);
};

const resolveEntry = <TCreator extends AnyQueryCreator>(
  creator: TCreator,
  args: ActionCallArgs<TCreator>,
  injector: EnvironmentInjector,
) => {
  let registry = registries.get(injector);

  if (!registry) {
    registry = new WeakMap();
    registries.set(injector, registry);
  }

  let entries = registry.get(creator);

  if (!entries) {
    entries = new Map();
    registry.set(creator, entries);
  }

  const key = hashArgs(toQueryArgs(args as Record<string, unknown>));
  let entry = entries.get(key);

  if (!entry) {
    entry = createToolkitHandle(creator, args, injector);
    entries.set(key, entry);
  }

  return entry;
};

/**
 * Returns the handle for a creator and args without executing it - the `FacadeBase.select(group, actionId)` of
 * `@tomtomb/ngrx-toolkit`. Args that build the same request (in any key order, other keys ignored) give the same
 * handle `toolkitCall` returns, so `toolkitSelect(getTeam, args, { injector }).refresh()` re-runs a request another
 * component started.
 */
export const toolkitSelect = <TCreator extends AnyQueryCreator>(
  creator: TCreator,
  args: ActionCallArgs<TCreator>,
  options?: ToolkitCallOptions,
): MappedEntityState<TCreator> =>
  resolveEntry(creator, args, resolveEnvironmentInjector(toolkitSelect, options)).handle;

/**
 * Executes a query creator with toolkit-shaped args and returns its handle - the `FacadeBase.call(group, args)` of
 * `@tomtomb/ngrx-toolkit`. Every call sends the request again; equal args return the same handle, which lives as
 * long as the injector.
 *
 * @example
 * ```ts
 * @Injectable({ providedIn: 'root' })
 * export class TeamFacade {
 *   private injector = inject(Injector);
 *
 *   getTeam(args: ActionCallArgs<typeof getTeam>) {
 *     return toolkitCall(getTeam, args, { injector: this.injector });
 *   }
 * }
 * ```
 */
export const toolkitCall = <TCreator extends AnyQueryCreator>(
  creator: TCreator,
  args: ActionCallArgs<TCreator>,
  options?: ToolkitCallOptions,
): MappedEntityState<TCreator> => {
  const entry = resolveEntry(creator, args, resolveEnvironmentInjector(toolkitCall, options));

  entry.call();

  return entry.handle;
};
