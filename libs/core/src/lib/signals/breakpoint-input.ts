import {
  InjectionToken,
  Injector,
  InputSignalWithTransform,
  Signal,
  booleanAttribute,
  computed,
  effect,
  inject,
  numberAttribute,
  signal,
  untracked,
} from '@angular/core';
import { SIGNAL } from '@angular/core/primitives/signals';
import { BREAKPOINT_ORDER, Breakpoint } from '../providers/breakpoint-observer';
import { setInputSignal } from '../utils';
import { injectCurrentBreakpoint } from './media-queries';

export type BreakpointMap<T> = Partial<Record<Breakpoint, T>>;
export type BreakpointInput<T> = T | BreakpointMap<T>;

const BREAKPOINT_KEY_SET = /* @__PURE__ */ new Set<string>(BREAKPOINT_ORDER);

const isBreakpointMap = (value: unknown): value is BreakpointMap<unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value);

  if (keys.length === 0) return false;

  const invalidKeys = keys.filter((key) => !BREAKPOINT_KEY_SET.has(key));

  if (!invalidKeys.length) return true;

  // One bad key makes the whole map inert - it stops being a breakpoint map and becomes a plain value, which
  // for an attribute binding means `[object Object]` and no effect at all. Silent, and expensive to find.
  if (ngDevMode && invalidKeys.length < keys.length) {
    console.warn(
      `[ethlete] A breakpoint map used the unknown key(s) ${invalidKeys.map((key) => `"${key}"`).join(', ')}, so ` +
        `the whole map was ignored. Valid keys are ${BREAKPOINT_ORDER.join(', ')} - there is no "default"; the ` +
        'smallest breakpoint is the fallback.',
    );
  }

  return false;
};

const resolveFromMap = <T>(map: BreakpointMap<T>, bp: Breakpoint, defaultValue: T): T => {
  const idx = BREAKPOINT_ORDER.indexOf(bp);
  for (let i = idx; i >= 0; i--) {
    const v = map[BREAKPOINT_ORDER[i] as Breakpoint];
    if (v !== undefined) return v;
  }
  return defaultValue;
};

export const breakpointTransformBase = <T, WriteT = BreakpointInput<T>>(
  coerce: (value: WriteT) => T,
): ((value: WriteT) => T) => {
  const currentBp = injectCurrentBreakpoint();
  const injector = inject(Injector);
  const raw = signal<BreakpointInput<T> | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let capturedDefault: T = undefined!;
  let initialized = false;

  let cachedSig: InputSignalWithTransform<T, any> | null = null;

  const transformFn = (value: WriteT): T => {
    const coerced: BreakpointInput<T> = isBreakpointMap(value) ? (value as unknown as BreakpointMap<T>) : coerce(value);
    if (!initialized) {
      capturedDefault = coerced as T;
      initialized = true;
    }
    raw.set(coerced);
    return isBreakpointMap(coerced)
      ? resolveFromMap(coerced as BreakpointMap<T>, currentBp(), capturedDefault)
      : (coerced as T);
  };

  effect(() => {
    const bp = currentBp();
    const r = raw();

    if (!cachedSig) {
      const instance = injector.get(BREAKPOINT_INSTANCE_TOKEN) as any;
      for (const key of Object.keys(instance)) {
        const val = instance[key];

        if (val && typeof val === 'function' && (val as any)[SIGNAL]?.transformFn === transformFn) {
          cachedSig = val as InputSignalWithTransform<T, any>;
          break;
        }
      }
    }

    if (!cachedSig || r === undefined || !isBreakpointMap(r)) return;
    const resolved = resolveFromMap(r as BreakpointMap<T>, bp, capturedDefault);

    untracked(() => setInputSignal(cachedSig as InputSignalWithTransform<T, any>, resolved));
  });

  return transformFn;
};

/**
 * Transform factory for boolean inputs.
 * Coerces plain values with `booleanAttribute`; resolves {@link BreakpointMap} mobile-first.
 *
 * @example
 * snap = input(false, { transform: boolBreakpointTransform() });
 * // Template: `snap` | `[snap]="true"` | `[snap]="{ xs: false, md: true }"`
 */
export const boolBreakpointTransform = (): ((value: BreakpointInput<boolean> | string) => boolean) =>
  breakpointTransformBase<boolean, BreakpointInput<boolean> | string>(booleanAttribute);

/**
 * Transform factory for number inputs.
 * Coerces plain values with `numberAttribute`; resolves {@link BreakpointMap} mobile-first.
 *
 * @example
 * scrollMargin = input(0, { transform: numberBreakpointTransform() });
 * // Template: `[scrollMargin]="16"` | `[scrollMargin]="{ xs: 0, md: 16 }"`
 */
export const numberBreakpointTransform = (): ((value: BreakpointInput<number> | string) => number) =>
  breakpointTransformBase<number, BreakpointInput<number> | string>((v) => numberAttribute(v));

/**
 * Transform factory for any typed input (string unions, arrays, objects, etc.).
 * Passes plain values through as-is; resolves {@link BreakpointMap} mobile-first.
 * A value is treated as a {@link BreakpointMap} only when all its keys are valid breakpoint names.
 *
 * @example
 * itemSize = input('auto', { transform: typedBreakpointTransform<ScrollableItemSize>() });
 * tags = input([], { transform: typedBreakpointTransform<string[]>() });
 * // Template: `[itemSize]="'third'"` | `[itemSize]="{ xs: 'full', md: 'third' }"`
 */
export const typedBreakpointTransform = <T>(): ((value: BreakpointInput<T>) => T) =>
  breakpointTransformBase((v) => v as T);

export type BoolBreakpointSignal = InputSignalWithTransform<boolean, BreakpointInput<boolean> | string>;
export type NumberBreakpointSignal = InputSignalWithTransform<number, BreakpointInput<number> | string>;
export type TypedBreakpointSignal<T> = InputSignalWithTransform<T, BreakpointInput<T>>;

export const injectBreakpointInput = <T>(inputSignal: Signal<BreakpointInput<T>>, defaultValue: T): Signal<T> => {
  const currentBreakpoint = injectCurrentBreakpoint();

  return computed(() => {
    const value = inputSignal();
    if (!isBreakpointMap(value)) return value as T;
    return resolveFromMap(value, currentBreakpoint(), defaultValue);
  });
};

export const booleanBreakpointAttribute = (value: unknown): BreakpointInput<boolean> => {
  if (isBreakpointMap(value)) return value as BreakpointMap<boolean>;
  return booleanAttribute(value);
};

export const numberBreakpointAttribute = (value: unknown): BreakpointInput<number> => {
  if (isBreakpointMap(value)) return value as BreakpointMap<number>;
  return numberAttribute(value);
};

export const BREAKPOINT_INSTANCE_TOKEN = new InjectionToken<unknown>('BREAKPOINT_INSTANCE_TOKEN');

export const provideBreakpointInstance = (componentClass: unknown) => ({
  provide: BREAKPOINT_INSTANCE_TOKEN,
  useExisting: componentClass,
});
