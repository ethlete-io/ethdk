import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { mountRating, RatingDriver } from '../../testing/rating-driver';
import { RATING_IMPORTS } from '../rating.imports';

@Component({
  template: `
    <et-rating
      [value]="value()"
      [allowHalf]="allowHalf()"
      [disabled]="disabled()"
      [max]="max()"
      (valueChange)="value.set($event)"
    >
      <et-label>Score</et-label>
    </et-rating>
  `,
  imports: [RATING_IMPORTS, LabelDirective],
})
class RatingEdgeHost {
  value = signal<number | null>(null);
  max = signal<number | undefined>(5);
  allowHalf = signal(false);
  disabled = signal(false);
}

describe('RatingDirective edge cases', () => {
  let driver: RatingDriver<RatingEdgeHost>;

  beforeEach(() => {
    driver = mountRating(RatingEdgeHost);
  });

  const setValue = (value: number | null) => {
    driver.host.value.set(value);
    driver.tick();
  };

  it('falls back to five icons when max is undefined', () => {
    driver.host.max.set(undefined);
    driver.tick();

    expect(driver.iconCount()).toBe(5);
    expect(driver.attr('aria-valuemax')).toBe('5');
  });

  it('starts at the first step from an empty value', () => {
    driver.press('ArrowRight');

    expect(driver.host.value()).toBe(1);
  });

  it('clears instead of going below zero from an empty value', () => {
    driver.press('ArrowLeft');

    expect(driver.host.value()).toBeNull();
  });

  it('reports zero for an empty value', () => {
    expect(driver.attr('aria-valuenow')).toBe('0');
  });

  it.each([
    ['NaN', Number.NaN],
    ['a negative number', -2],
  ])('fills no icon and reports zero for a value of %s', (_, value) => {
    setValue(value);

    expect(driver.attr('aria-valuenow')).toBe('0');
    expect(driver.fill().icons).toBe('0');
  });

  it.each([
    ['NaN', Number.NaN],
    ['a negative number', -2],
  ])('steps up to the first step from a value of %s', (_, value) => {
    setValue(value);

    driver.press('ArrowRight');

    expect(driver.host.value()).toBe(1);
  });

  it('snaps an off-step value onto the step grid when stepping with the keyboard', () => {
    setValue(2.5);

    driver.press('ArrowRight');
    expect(driver.host.value()).toBe(3);

    setValue(2.5);

    driver.press('ArrowLeft');
    expect(driver.host.value()).toBe(2);
  });

  it('caps a value above max for display and steps down from the cap', () => {
    setValue(9);

    expect(driver.attr('aria-valuenow')).toBe('5');

    driver.press('ArrowLeft');

    expect(driver.host.value()).toBe(4);
  });

  it('clears a value of exactly one half step with ArrowLeft in half mode', () => {
    driver.host.allowHalf.set(true);
    setValue(0.5);

    driver.press('ArrowLeft');

    expect(driver.host.value()).toBeNull();
  });

  it('ignores the keyboard and pointer while disabled', () => {
    driver.host.disabled.set(true);
    setValue(2);

    driver.press('ArrowRight');
    driver.clickIcon(4);

    expect(driver.host.value()).toBe(2);
    expect(driver.attr('tabindex')).toBe('-1');
  });
});
