// codes 3800-3899
export const CAROUSEL_ERROR_CODES = {
  /** A carousel part (`etCarouselSlide`, `etCarouselItem`, a control, autoplay) was used outside an `[etCarousel]`. */
  PART_OUTSIDE_CAROUSEL: 3800,
  /** An `[etCarousel]` rendered no `etCarouselItem`, so it has no slides. */
  MISSING_ITEMS: 3801,
  /** An `[etCarousel]` has no scrollable to move - it is not on an `[etScrollable]` element. */
  MISSING_SCROLLABLE: 3803,
  /** Autoplay is on without a control to pause it (WCAG 2.2.2). */
  AUTOPLAY_WITHOUT_PAUSE_CONTROL: 3802,
  /** An `<et-carousel>` was given no `etCarouselSlide` template, so it has nothing to render. */
  MISSING_SLIDE_TEMPLATE: 3804,
} as const;
