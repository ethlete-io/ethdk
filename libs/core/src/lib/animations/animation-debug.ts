export const ANIMATION_DEBUG_STORAGE_KEY = 'et-overlay-debug';

let cachedEnabled: boolean | null = null;

/**
 * Debug logging for overlay and animation lifecycle internals.
 * Enable via `localStorage.setItem('et-overlay-debug', 'true')` and reload.
 */
export const isAnimationDebugEnabled = () => {
  if (cachedEnabled === null) {
    try {
      cachedEnabled = globalThis.localStorage?.getItem(ANIMATION_DEBUG_STORAGE_KEY) === 'true';
    } catch {
      cachedEnabled = false;
    }
  }

  return cachedEnabled;
};

export const animationDebugLog = (scope: string, ...args: unknown[]) => {
  if (!isAnimationDebugEnabled()) return;

  const timestamp = (globalThis.performance?.now() ?? 0).toFixed(1);

  console.log(`\x1B[36m[et-overlay-debug ${timestamp}ms | ${scope}]\x1B[m`, ...args);
};
