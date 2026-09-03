import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountRating, RatingDriver } from '../../testing/rating-driver';
import { RATING_ERROR_CODES } from '../rating-errors';
import { RATING_IMPORTS } from '../rating.imports';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';

@Component({
  template: `
    <et-rating
      [value]="value()"
      [mixed]="mixed()"
      [mixedLabel]="mixedLabel()"
      [allowHalf]="allowHalf()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [max]="4"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
    >
      <et-label>Test label</et-label>
    </et-rating>
  `,
  imports: [RATING_IMPORTS, LabelDirective],
})
class RatingTestHost {
  value = signal<number | null>(null);
  mixed = signal(false);
  mixedLabel = signal('Mixed');
  allowHalf = signal(false);
  disabled = signal(false);
  readonly = signal(false);
}

@Component({
  template: `
    <et-rating>
      <ng-template etRatingIcon></ng-template>
      <ng-template etRatingIcon></ng-template>
    </et-rating>
  `,
  imports: [RATING_IMPORTS],
})
class DuplicateRatingIconTestHost {}

describe('RatingDirective', () => {
  let driver: RatingDriver<RatingTestHost>;

  beforeEach(() => {
    driver = mountRating(RatingTestHost);
  });

  it('renders a slider with one icon per step and an empty fill', () => {
    expect(driver.attr('role')).toBe('slider');
    expect(driver.attr('aria-valuemin')).toBe('0');
    expect(driver.attr('aria-valuemax')).toBe('4');
    expect(driver.attr('aria-valuetext')).toBe('No rating');
    expect(driver.iconCount()).toBe(4);
    // base row + fill overlay row
    expect(driver.rowCount()).toBe(2);
    expect(driver.fill()).toEqual({ icons: '0', gaps: '0' });
  });

  it('reflects the value in the continuous fill width and aria', () => {
    driver.host.value.set(3);
    driver.tick();

    // 3 icon widths + the 2 gaps the fill crosses
    expect(driver.fill()).toEqual({ icons: '3', gaps: '2' });
    expect(driver.attr('aria-valuenow')).toBe('3');
    expect(driver.attr('aria-valuetext')).toBe('3 of 4');
  });

  it('renders half values as a mid-icon fill width', () => {
    driver.host.allowHalf.set(true);
    driver.host.value.set(2.5);
    driver.tick();

    expect(driver.fill()).toEqual({ icons: '2.5', gaps: '2' });
    expect(driver.attr('aria-valuetext')).toBe('2.5 of 4');
  });

  it('steps with arrow keys, clamps at max and clears below the first step', () => {
    driver.press('ArrowRight');
    expect(driver.host.value()).toBe(1);

    driver.press('ArrowRight');
    driver.press('ArrowRight');
    driver.press('ArrowRight');
    driver.press('ArrowRight');
    expect(driver.host.value()).toBe(4);

    driver.press('ArrowLeft');
    expect(driver.host.value()).toBe(3);

    driver.press('Home');
    expect(driver.host.value()).toBe(1);

    driver.press('ArrowLeft');
    expect(driver.host.value()).toBeNull();

    driver.press('End');
    expect(driver.host.value()).toBe(4);

    driver.press('Backspace');
    expect(driver.host.value()).toBeNull();
  });

  it('uses half steps for keyboard when allowHalf is set', () => {
    driver.host.allowHalf.set(true);
    driver.tick();

    driver.press('ArrowRight');
    expect(driver.host.value()).toBe(0.5);

    driver.press('ArrowRight');
    expect(driver.host.value()).toBe(1);
  });

  it('commits on icon click and clears when the current value is picked again', () => {
    driver.clickIcon(2);
    expect(driver.host.value()).toBe(3);

    driver.clickIcon(2);
    expect(driver.host.value()).toBeNull();
  });

  describe('pointer interaction', () => {
    it('previews the icon under a hovering mouse without committing', () => {
      driver.pointer('pointermove', 45);

      expect(driver.fill().icons).toBe('3');
      expect(driver.host.value()).toBeNull();
    });

    it('previews along a drag and commits where the pointer is released', () => {
      driver.pointer('pointerdown', 10);
      expect(driver.fill().icons).toBe('1');

      driver.pointer('pointermove', 65);
      expect(driver.fill().icons).toBe('4');
      expect(driver.host.value()).toBeNull();

      driver.pointer('pointerup', 45);
      expect(driver.host.value()).toBe(3);
    });

    it('commits the pressed icon when the press is released without moving', () => {
      driver.pointer('pointerdown', 25);
      driver.pointer('pointerup', 25);

      expect(driver.host.value()).toBe(2);
    });

    it('commits nothing and drops the preview when the browser takes the drag away', () => {
      driver.pointer('pointerdown', 10);
      driver.pointer('pointermove', 65);
      driver.pointer('pointercancel', 65);

      expect(driver.host.value()).toBeNull();
      expect(driver.fill().icons).toBe('0');

      // the gesture is over - later moves preview again instead of extending it
      driver.pointer('pointermove', 25);
      expect(driver.fill().icons).toBe('2');
    });

    it('ignores a secondary-button press', () => {
      driver.pointer('pointerdown', 45, { button: 2 });
      driver.pointer('pointerup', 45);

      expect(driver.host.value()).toBeNull();
    });
  });

  it('ignores interaction while disabled or readonly', () => {
    driver.host.disabled.set(true);
    driver.tick();

    driver.clickIcon(1);
    driver.press('ArrowRight');
    expect(driver.host.value()).toBeNull();
    expect(driver.attr('tabindex')).toBe('-1');

    driver.host.disabled.set(false);
    driver.host.readonly.set(true);
    driver.tick();

    driver.clickIcon(1);
    driver.press('ArrowRight');
    expect(driver.host.value()).toBeNull();
    expect(driver.attr('tabindex')).toBe('0');
  });

  describe('mixed', () => {
    beforeEach(() => {
      driver.host.value.set(3);
      driver.host.mixed.set(true);
      driver.tick();
    });

    it('fills no icons, removes aria-valuenow and announces the mixed label', () => {
      expect(driver.fill()).toEqual({ icons: '0', gaps: '0' });
      expect(driver.hasAttr('aria-valuenow')).toBe(false);
      expect(driver.attr('aria-valuetext')).toBe('Mixed');
      expect(driver.attr('data-mixed')).toBe('true');

      driver.host.mixedLabel.set('Different ratings');
      driver.tick();

      expect(driver.attr('aria-valuetext')).toBe('Different ratings');
    });

    it('keeps the hover preview working over the masked value', () => {
      driver.rating.setHoverValue(2);
      driver.tick();

      expect(driver.fill()).toEqual({ icons: '2', gaps: '1' });

      driver.rating.clearHover();
      driver.tick();

      expect(driver.fill()).toEqual({ icons: '0', gaps: '0' });
      expect(driver.host.mixed()).toBe(true);
    });

    it('always commits a pick - even the hidden raw value - instead of clearing by repick', () => {
      driver.clickIcon(2);

      expect(driver.host.value()).toBe(3);
      expect(driver.host.mixed()).toBe(false);
      expect(driver.attr('aria-valuenow')).toBe('3');

      // resolved - the normal clear-by-repick behavior is back
      driver.clickIcon(2);

      expect(driver.host.value()).toBeNull();
    });

    it('starts keyboard steps from the visible zero and resolves on the first write', () => {
      driver.press('ArrowRight');

      expect(driver.host.value()).toBe(1);
      expect(driver.host.mixed()).toBe(false);
    });

    it('clears to null and resolves via Backspace or Delete', () => {
      driver.press('Delete');

      expect(driver.host.value()).toBeNull();
      expect(driver.host.mixed()).toBe(false);
      expect(driver.attr('aria-valuetext')).toBe('No rating');
    });

    it('stays mixed across external value writes and ignored interactions', () => {
      driver.host.value.set(2);
      driver.tick();

      expect(driver.host.mixed()).toBe(true);
      expect(driver.fill()).toEqual({ icons: '0', gaps: '0' });

      driver.host.readonly.set(true);
      driver.tick();

      driver.clickIcon(1);
      driver.press('ArrowRight');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe(2);
    });
  });
});

describe('RatingDirective (mixed contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountRating(RatingTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set(3);
        driver.host.mixed.set(true);
        driver.tick();
      },
      rawValue: () => 3,
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.ratingEl(),
      writeValueExternally: () => {
        driver.host.value.set(1);
        driver.tick();
      },
      externallyWrittenValue: () => 1,
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.tick();
      },
      mixedLabel: () => driver.host.mixedLabel(),
      mixedDisplayText: () => driver.attr('aria-valuetext') ?? '',
      commit: () => driver.clickIcon(1),
      committedValue: () => 2,
      assertMasked: () => {
        expect(driver.hasAttr('aria-valuenow')).toBe(false);
        expect(driver.attr('aria-valuetext')).toBe('Mixed');
      },
      clear: () => {
        driver.press('Backspace');
      },
      emptyValue: () => null,
    };
  });
});

describe('RatingDirective errors', () => {
  it('rejects a second custom icon template', () => {
    TestBed.configureTestingModule({
      imports: [DuplicateRatingIconTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    expect(() => TestBed.createComponent(DuplicateRatingIconTestHost)).toThrow(
      `ET${RATING_ERROR_CODES.DUPLICATE_ICON_TEMPLATE}`,
    );
  });
});
