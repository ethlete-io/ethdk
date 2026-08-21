/**
 * Whether a devtools UI is on the page, which is what the floating pills follow. Kept apart from the
 * pills themselves so `@ethlete/query-devtools/toggle` can declare itself without pulling the pill
 * renderer into the bundle an application ships.
 */

let mounted = 0;
let settled = false;
let notify: (() => void) | null = null;

/**
 * Declares a devtools UI on the page, and takes the declaration back when it goes. The floating pills
 * paint only while one is mounted, so an application that renders no devtools trigger shows no pills
 * either.
 *
 * Part of the devtools contract. **Not part of the general public contract.**
 */
export const setQueryDevtoolsUiMounted = (isMounted: boolean) => {
  mounted = Math.max(0, mounted + (isMounted ? 1 : -1));
  notify?.();
};

/**
 * Says the application has rendered and settled, which is what lets the pills stop painting where no
 * devtools UI is mounted. Called by `provideQueryDevtools()`.
 * @internal
 */
export const markQueryDevtoolsAppSettled = () => {
  settled = true;
  notify?.();
};

/**
 * Whether the pills may paint. Until the application settles they do whatever the UI does: a boot that
 * hangs on the backend it was just pointed at renders no component at all, and is the case they exist
 * for.
 * @internal
 */
export const queryDevtoolsPillsAllowed = () => mounted > 0 || !settled;

/** Hands the pills a way to repaint on a change here. Called by the pill renderer. @internal */
export const onQueryDevtoolsUiChange = (listener: () => void) => {
  notify = listener;
};
