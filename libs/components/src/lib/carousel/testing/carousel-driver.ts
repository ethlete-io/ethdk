import { ComponentFixture } from '@angular/core/testing';
import { query, queryAll } from '../../testing/driver-core';

/**
 * Waits for the track's mutation-observer-reported children to catch up with a slides change, then
 * flushes change detection - the observer reports asynchronously, so anything reading DOM slide
 * count (clones included) right after a signal write sees the stale count otherwise.
 */
export const settleCarouselChildren = async <T>(fixture: ComponentFixture<T>) => {
  await new Promise<void>((resolve) => setTimeout(resolve));
  fixture.detectChanges();
};

/** Slides, dots and controls of an `<et-carousel>` (or a headless `etCarousel` composition) under `fixture`. */
export const createCarouselDriver = <T>(fixture: ComponentFixture<T>) => ({
  fixture,

  slides: () => queryAll(fixture, '.et-carousel-item'),
  dots: () => queryAll(fixture, '.et-carousel-dot'),
  scrollContainer: () => query(fixture, '.et-scrollable-container'),

  next: () => query<HTMLButtonElement>(fixture, '[etCarouselNext]'),
  previous: () => query<HTMLButtonElement>(fixture, '[etCarouselPrevious]'),
  playToggle: () => query<HTMLButtonElement>(fixture, '[etCarouselPlayToggle]'),

  settle: () => settleCarouselChildren(fixture),
});
