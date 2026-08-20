import { clamp } from '@ethlete/core';
import { ScrollbarGeometry, ScrollbarOrientation } from '../scrollbar.types';

export const NO_SCROLLBAR_GEOMETRY: ScrollbarGeometry = {
  canScroll: false,
  thumbSize: 0,
  thumbOffset: 0,
  progress: 0,
};

export type ScrollMetrics = {
  viewportSize: number;
  contentSize: number;
  maxScroll: number;
};

export const readScrollMetrics = (target: HTMLElement, orientation: ScrollbarOrientation): ScrollMetrics => {
  const isHorizontal = orientation === 'horizontal';
  const viewportSize = isHorizontal ? target.clientWidth : target.clientHeight;
  const contentSize = isHorizontal ? target.scrollWidth : target.scrollHeight;

  return { viewportSize, contentSize, maxScroll: Math.max(0, contentSize - viewportSize) };
};

/**
 * How far the target is scrolled from the start edge, which is the right edge in a right-to-left
 * container. `scrollLeft` counts down from 0 into negative numbers there, so the sign carries the
 * direction and only the magnitude is a distance. Read it directly and every right-to-left thumb
 * sits at the start.
 */
export const readScrollDistance = (target: HTMLElement, orientation: ScrollbarOrientation) =>
  orientation === 'horizontal' ? Math.abs(target.scrollLeft) : target.scrollTop;

export const scrollToDistance = (options: {
  target: HTMLElement;
  orientation: ScrollbarOrientation;
  distance: number;
  isRtl: boolean;
  behavior: ScrollBehavior;
}) => {
  const { target, orientation, distance, isRtl, behavior } = options;

  if (orientation === 'horizontal') {
    target.scroll({ left: isRtl ? -distance : distance, behavior });
  } else {
    target.scroll({ top: distance, behavior });
  }
};

export const measureScrollbar = (options: {
  target: HTMLElement;
  orientation: ScrollbarOrientation;
  trackSize: number;
  minThumbSize: number;
}): ScrollbarGeometry => {
  const { target, orientation, trackSize, minThumbSize } = options;
  const { viewportSize, contentSize, maxScroll } = readScrollMetrics(target, orientation);

  if (maxScroll <= 0 || trackSize <= 0) return NO_SCROLLBAR_GEOMETRY;

  const thumbSize = clamp(trackSize * (viewportSize / contentSize), Math.min(minThumbSize, trackSize), trackSize);
  const progress = clamp(readScrollDistance(target, orientation) / maxScroll, 0, 1);

  return { canScroll: true, thumbSize, thumbOffset: (trackSize - thumbSize) * progress, progress };
};
