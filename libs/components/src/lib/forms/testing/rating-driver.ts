import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { pointerEvent, pressKey } from '../../testing/driver-core';
import { RatingDirective } from '../rating/headless';

const RATING = 'et-rating';
const ICON_WIDTH = 20;

/**
 * jsdom measures every element as 0x0, so a rating can map no pointer position until its icons
 * report a size. Every driver stubs a row of {@link ICON_WIDTH}-wide icons at mount.
 */
export const createRatingDriver = <T>(fixture: ComponentFixture<T>, options: ControlDriverOptions = {}) => {
  const base = createControlDriver(fixture, RatingDirective, { directiveSelector: RATING, ...options });

  const ratingEl = () => base.query(RATING)!;
  const surfaceEl = () => base.query('.et-rating-icons')!;
  const iconEls = () => base.queryAll('.et-rating-row:first-of-type .et-rating-icon');

  iconEls().forEach((icon, position) => {
    const left = position * ICON_WIDTH;
    const rect = { left, right: left + ICON_WIDTH, width: ICON_WIDTH, top: 0, bottom: 20, height: 20 } as DOMRect;

    icon.getBoundingClientRect = () => rect;
  });

  return {
    ...base,
    rating: base.control,

    ratingEl,
    attr: (name: string) => ratingEl().getAttribute(name),
    hasAttr: (name: string) => ratingEl().hasAttribute(name),

    iconCount: () => iconEls().length,
    rowCount: () => base.queryAll('.et-rating-row').length,
    clickIcon: (index: number) => base.click(iconEls()[index]!),

    fill: () => ({
      icons: surfaceEl().style.getPropertyValue('--_et-rating-fill-icons'),
      gaps: surfaceEl().style.getPropertyValue('--_et-rating-fill-gaps'),
    }),

    press: (key: string) => pressKey(ratingEl(), key),
    pointer: (type: string, clientX: number, init: PointerEventInit = {}) =>
      pointerEvent(surfaceEl(), type, { clientX, button: 0, pointerType: 'mouse', ...init }),
  };
};

export type RatingDriver<T> = ReturnType<typeof createRatingDriver<T>>;

export const mountRating = <T>(component: Type<T>, options: ControlDriverOptions = {}, providers: Provider[] = []) =>
  createRatingDriver(mountControl(component, providers), options);
