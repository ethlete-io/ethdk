import { Signal, signal } from '@angular/core';
import { renderQueryDevtoolsApiEnvPill } from './query-devtools-api-env-pill';

/** One backend a {@link QueryDevtoolsApiEnvSwitch} can point the application at. */
export type QueryDevtoolsApiEnv = {
  /** What is written to the switch's key. The value the application itself reads. */
  id: string;

  /** Shown instead of the id, where the id alone does not read well. */
  label?: string;

  /** The base URL this env resolves to, shown next to the name so the pick says where it points. */
  url?: string;

  /**
   * Marks a backend whose data is real. While it is the pick, the picker paints itself as a warning and
   * frames the page, so nobody types into production believing it is staging.
   */
  production?: boolean;
};

/**
 * One key in `localStorage` an application reads at startup to pick a backend, described so the panel
 * can offer the envs behind it. The panel only writes the key and reloads: which URL an env resolves
 * to, and when the value is read, stay the application's own business.
 *
 * @see QueryDevtoolsOptions.apiEnvs
 */
export type QueryDevtoolsApiEnvSwitch = {
  /** Names the switch in the panel, for example `Hub API`. */
  name: string;

  /** The `localStorage` key the application reads. */
  storageKey: string;

  envs: QueryDevtoolsApiEnv[];

  /** The env the application falls back to with nothing stored, labelled as the default. */
  fallback?: string;

  /** Whether a base URL may be typed in instead of picking one of {@link envs}. */
  custom?: boolean;
};

const switches = /* @__PURE__ */ signal<QueryDevtoolsApiEnvSwitch[]>([]);
const values = /* @__PURE__ */ signal<Record<string, string | null>>({});

/**
 * The API env switches the application declared, or an empty list. Both the floating toggle and the
 * panel's Settings tab render nothing at all until an application declares one.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsApiEnvs: Signal<QueryDevtoolsApiEnvSwitch[]> = /* @__PURE__ */ switches.asReadonly();

/**
 * What each switch's key holds now, keyed by that key. `null` for a key nothing has written, which is
 * the switch's own fallback.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const queryDevtoolsApiEnvValues: Signal<Record<string, string | null>> = /* @__PURE__ */ values.asReadonly();

const read = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * Declares the switches and reads what each key holds. Called by `provideQueryDevtools()` and by
 * nothing else.
 * @internal
 */
export const setQueryDevtoolsApiEnvs = (list: QueryDevtoolsApiEnvSwitch[] | undefined) => {
  switches.set(list ?? []);
  values.set(Object.fromEntries((list ?? []).map((entry) => [entry.storageKey, read(entry.storageKey)])));
  renderQueryDevtoolsApiEnvPill(list ?? [], read, pickAndReload);
};

/**
 * Writes one switch's key, or removes it when `value` is `null` so the application falls back. The
 * application reads the key before Angular boots, so this takes effect on the next page load only -
 * callers reload.
 *
 * The value is written as the plain string the application reads. Do not route it through
 * `writeQueryDevtoolsStore`: that JSON-encodes, and the quotes would reach the application.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const setQueryDevtoolsApiEnv = (storageKey: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(storageKey);
    else window.localStorage.setItem(storageKey, value);
  } catch {
    // ignore (private mode / disabled storage / quota)
  }

  values.update((current) => ({ ...current, [storageKey]: read(storageKey) }));
};

/**
 * What the floating pill does on a pick. The application reads the key before Angular boots, so a
 * reload is the only way to apply one.
 */
const pickAndReload = (storageKey: string, value: string | null) => {
  setQueryDevtoolsApiEnv(storageKey, value);
  window.location.reload();
};
