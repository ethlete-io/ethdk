import { Component, signal } from '@angular/core';
import '../../../test-helpers';
import { LabelDirective } from '../form-field/headless';
import { mountRating, RatingDriver } from '../testing/rating-driver';
import { RATING_IMPORTS } from './rating.imports';

const ICON_WIDTH = 20;

@Component({
  template: `
    <et-rating
      [value]="value()"
      [allowHalf]="allowHalf()"
      [style.direction]="direction()"
      [max]="4"
      (valueChange)="value.set($event)"
    >
      <et-label>Test label</et-label>
    </et-rating>
  `,
  imports: [RATING_IMPORTS, LabelDirective],
})
class RatingHost {
  value = signal<number | null>(null);
  allowHalf = signal(false);
  direction = signal<'ltr' | 'rtl'>('ltr');
}

const mirrorIcons = (driver: RatingDriver<RatingHost>) => {
  const icons = driver.ratingEl().querySelectorAll<HTMLElement>('.et-rating-row:first-of-type .et-rating-icon');

  icons.forEach((icon, position) => {
    const left = (icons.length - 1 - position) * ICON_WIDTH;
    const rect = { left, right: left + ICON_WIDTH, width: ICON_WIDTH, top: 0, bottom: 20, height: 20 } as DOMRect;

    icon.getBoundingClientRect = () => rect;
  });
};

const clickIconAt = (driver: RatingDriver<RatingHost>, index: number, clientX: number) => {
  const icon = driver.ratingEl().querySelectorAll('.et-rating-row:first-of-type .et-rating-icon')[index]!;

  icon.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX }));
  driver.tick();
};

describe('RatingComponent pointer logic', () => {
  let driver: RatingDriver<RatingHost>;

  beforeEach(() => {
    driver = mountRating(RatingHost);
  });

  describe('half steps', () => {
    beforeEach(() => {
      driver.host.allowHalf.set(true);
      driver.tick();
    });

    it('resolves the first half of an icon to a half value and the second half to the whole value', () => {
      driver.pointer('pointermove', 45);
      expect(driver.fill().icons).toBe('2.5');

      driver.pointer('pointermove', 55);
      expect(driver.fill().icons).toBe('3');
    });

    it('never previews below half a step on the first icon', () => {
      driver.pointer('pointermove', 3);

      expect(driver.fill().icons).toBe('0.5');
    });

    it('commits the half value where a drag is released', () => {
      driver.pointer('pointerdown', 10);
      driver.pointer('pointermove', 65);
      driver.pointer('pointerup', 45);

      expect(driver.host.value()).toBe(2.5);
    });

    it('resolves a click on the first half of an icon to a half value', () => {
      clickIconAt(driver, 2, 45);

      expect(driver.host.value()).toBe(2.5);
    });

    it('resolves a click on the second half of an icon to the whole value', () => {
      clickIconAt(driver, 2, 55);

      expect(driver.host.value()).toBe(3);
    });
  });

  describe('right-to-left', () => {
    beforeEach(() => {
      driver.host.direction.set('rtl');
      driver.tick();
      mirrorIcons(driver);
    });

    it('measures the offset from the right edge of an icon', () => {
      driver.pointer('pointermove', 75);
      expect(driver.fill().icons).toBe('1');

      driver.pointer('pointermove', 35);
      expect(driver.fill().icons).toBe('3');
    });

    it('puts the half step on the inline-start side of an icon', () => {
      driver.host.allowHalf.set(true);
      driver.tick();

      driver.pointer('pointermove', 75);
      expect(driver.fill().icons).toBe('0.5');

      driver.pointer('pointermove', 65);
      expect(driver.fill().icons).toBe('1');
    });

    it('measures a click from the right edge as well', () => {
      driver.host.allowHalf.set(true);
      driver.tick();

      clickIconAt(driver, 0, 75);

      expect(driver.host.value()).toBe(0.5);
    });
  });

  describe('the click that follows a pointer commit', () => {
    it('is swallowed once, so it does not clear the value the press just picked', () => {
      driver.pointer('pointerdown', 25);
      driver.pointer('pointerup', 25);
      expect(driver.host.value()).toBe(2);

      clickIconAt(driver, 1, 25);
      expect(driver.host.value()).toBe(2);
    });

    it('lets the next click through', () => {
      driver.pointer('pointerdown', 25);
      driver.pointer('pointerup', 25);

      clickIconAt(driver, 1, 25);
      clickIconAt(driver, 1, 25);

      expect(driver.host.value()).toBeNull();
    });
  });

  describe('touch', () => {
    it('does not preview a resting finger as a hover', () => {
      driver.pointer('pointermove', 45, { pointerType: 'touch' });

      expect(driver.fill().icons).toBe('0');
    });

    it('drops the preview once the finger lifts', () => {
      driver.pointer('pointerdown', 10, { pointerType: 'touch' });
      driver.pointer('pointermove', 65, { pointerType: 'touch' });
      expect(driver.fill().icons).toBe('4');

      driver.pointer('pointerup', 45, { pointerType: 'touch' });

      expect(driver.host.value()).toBe(3);
      expect(driver.fill().icons).toBe('3');
    });
  });
});
