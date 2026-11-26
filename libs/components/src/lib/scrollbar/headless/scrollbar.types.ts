import { ElementRef } from '@angular/core';

export type ScrollbarOrientation = 'horizontal' | 'vertical';

/** The scroll container a scrollbar mirrors. A template reference variable on the element is the usual value. */
export type ScrollbarTarget = HTMLElement | ElementRef<HTMLElement> | null | undefined;

/** Where the thumb sits right now, in pixels along the track. */
export type ScrollbarGeometry = {
  /** Whether the target overflows on this scrollbar's axis. */
  canScroll: boolean;
  /** Length of the thumb along the track. */
  thumbSize: number;
  /** Distance from the track's inline or block start to the thumb. */
  thumbOffset: number;
  /** How far the target is scrolled, from 0 at the start to 1 at the end. */
  progress: number;
};
