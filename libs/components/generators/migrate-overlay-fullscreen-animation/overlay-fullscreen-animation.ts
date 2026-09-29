import { RemovedExport } from '../removed-exports/removed-exports.js';

const NAMES = [
  'ViewportTransformData',
  'FullscreenAnimationCancellable',
  'FullscreenAnimationState',
  'FullscreenAnimationDeps',
  'cleanupFullscreenAnimationStyles',
  'startFullscreenEnterAnimation',
  'startFullscreenLeaveAnimation',
  'cleanupFullscreenAnimation',
  'abortFullscreenAnimation',
] as const;

export const OVERLAY_FULLSCREEN_ANIMATION_REMOVALS: readonly RemovedExport[] = NAMES.map((name) => ({
  name,
  todo: `${name} is no longer exported; the full-screen morph animation is internal to fullScreenDialogOverlayStrategy. Configure the strategy instead of driving the animation yourself.`,
}));
