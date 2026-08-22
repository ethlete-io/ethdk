import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountRangeSlider, RangeSliderDriver } from '../../testing/slider-driver';
import { SLIDER_IMPORTS } from '../slider.imports';
import { RangeSliderValue } from './range-slider.directive';
import { SliderMarks, SliderOrientation } from './slider.tokens';

@Component({
  template: `
    <et-range-slider
      [value]="value()"
      [mixed]="mixed()"
      [mixedLabel]="mixedLabel()"
      [minValue]="minValue()"
      [maxValue]="maxValue()"
      [step]="step()"
      [minDistance]="minDistance()"
      [orientation]="orientation()"
      [marks]="marks()"
      [snapToMarks]="snapToMarks()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
    />
  `,
  imports: [SLIDER_IMPORTS],
})
class RangeSliderTestHost {
  value = signal<RangeSliderValue>([20, 80]);
  mixed = signal(false);
  mixedLabel = signal('Mixed');
  minValue = signal(0);
  maxValue = signal(100);
  step = signal(1);
  minDistance = signal(0);
  orientation = signal<SliderOrientation>('horizontal');
  marks = signal<SliderMarks>(false);
  snapToMarks = signal(false);
  disabled = signal(false);
}

describe('RangeSliderDirective', () => {
  let driver: RangeSliderDriver<RangeSliderTestHost>;

  beforeEach(() => {
    driver = mountRangeSlider(RangeSliderTestHost);
  });

  it('renders two labelled thumbs whose ARIA bounds reflect the other thumb', () => {
    expect(driver.thumbEls()).toHaveLength(2);
    expect(driver.thumbAttrs('aria-label')).toEqual(['Minimum', 'Maximum']);
    expect(driver.thumbAttrs('aria-valuenow')).toEqual(['20', '80']);
    expect(driver.thumbAttrs('aria-valuemin')).toEqual(['0', '20']);
    expect(driver.thumbAttrs('aria-valuemax')).toEqual(['80', '100']);
  });

  it('normalizes a reversed value tuple for display', () => {
    driver.host.value.set([90, 10]);
    driver.tick();

    expect(driver.thumbAttrs('aria-valuenow')).toEqual(['10', '90']);
  });

  it('keeps thumbs from crossing via the keyboard', () => {
    driver.host.value.set([70, 80]);
    driver.tick();

    driver.press('End', 0);
    expect(driver.host.value()).toEqual([80, 80]);

    driver.press('Home', 1);
    expect(driver.host.value()).toEqual([80, 80]);
  });

  it('honors minDistance between the thumbs', () => {
    driver.host.minDistance.set(10);
    driver.host.value.set([60, 80]);
    driver.tick();

    driver.press('End', 0);
    expect(driver.host.value()).toEqual([70, 80]);
    expect(driver.thumbAttr('aria-valuemax', 0)).toBe('70');
  });

  it('moves the nearest thumb on a track pointerdown', () => {
    driver.pointer('pointerdown', 30);
    expect(driver.host.value()).toEqual([30, 80]);
    driver.pointer('pointerup', 30);

    driver.pointer('pointerdown', 70);
    expect(driver.host.value()).toEqual([30, 70]);
    driver.pointer('pointerup', 70);
  });

  it('drags a thumb without letting it cross its sibling', () => {
    driver.pointer('pointerdown', 25);
    expect(driver.host.value()).toEqual([25, 80]);

    driver.pointer('pointermove', 95);
    expect(driver.host.value()).toEqual([80, 80]);

    driver.pointer('pointerup', 95);
    expect(driver.hasAttr('data-dragging')).toBe(false);
  });

  it('emits nothing while disabled', () => {
    driver.host.disabled.set(true);
    driver.tick();

    driver.press('ArrowRight', 0);
    driver.pointer('pointerdown', 50);
    expect(driver.host.value()).toEqual([20, 80]);
  });

  describe('vertical orientation', () => {
    beforeEach(() => {
      driver.host.orientation.set('vertical');
      driver.tick();
      driver.stubTrack('vertical');
    });

    it('exposes the orientation on the host and both thumbs', () => {
      expect(driver.attr('data-orientation')).toBe('vertical');
      expect(driver.thumbAttrs('aria-orientation')).toEqual(['vertical', 'vertical']);
      expect(driver.thumbTouchActions()).toEqual(['pan-x', 'pan-x']);
    });

    it('moves the nearest thumb bottom→up without letting the thumbs cross', () => {
      driver.pointer('pointerdown', 0, 75);
      expect(driver.host.value()).toEqual([25, 80]);

      driver.pointer('pointermove', 0, 0);
      expect(driver.host.value()).toEqual([80, 80]);

      driver.pointer('pointerup', 0, 0);
      expect(driver.hasAttr('data-dragging')).toBe(false);
    });
  });

  describe('marks', () => {
    it('flags the ticks between the thumbs as active', () => {
      driver.host.marks.set(true);
      driver.host.step.set(25);
      driver.tick();

      // the [20, 80] value snaps onto the step grid first - the 25/50/75 ticks are inside the fill
      expect(driver.markActives()).toEqual([false, true, true, true, false]);
    });

    it('commits an off-grid tick exactly to the nearest thumb', () => {
      driver.host.step.set(10);
      driver.host.marks.set([{ value: 25 }, { value: 50 }]);
      driver.tick();

      driver.pointerOnMark(0);

      expect(driver.host.value()).toEqual([25, 80]);
      expect(driver.thumbAttrs('aria-valuenow')).toEqual(['25', '80']);
    });

    it('snaps both thumbs onto the marks while honoring minDistance', () => {
      driver.host.marks.set([{ value: 0 }, { value: 25 }, { value: 50 }, { value: 75 }, { value: 100 }]);
      driver.host.snapToMarks.set(true);
      driver.host.minDistance.set(25);
      driver.host.value.set([25, 75]);
      driver.tick();

      // End would jump to 100 - the sibling limit stops it at 50, which is itself a mark
      driver.press('End', 0);
      expect(driver.host.value()).toEqual([50, 75]);

      driver.host.value.set([25, 75]);
      driver.tick();

      // a pointer at 60 snaps the nearest thumb (the end one) down to the 50 mark
      driver.pointer('pointerdown', 60);
      expect(driver.host.value()).toEqual([25, 50]);
      driver.pointer('pointerup', 60);

      // one more mark down would breach the minimum distance
      driver.press('ArrowDown', 1);
      expect(driver.host.value()).toEqual([25, 50]);
    });
  });

  describe('mixed', () => {
    beforeEach(() => {
      driver.host.mixed.set(true);
      driver.tick();
    });

    it('masks both thumbs: no aria-valuenow, mixed label as valuetext, parked at the track start', () => {
      expect(driver.thumbAttrs('aria-valuenow')).toEqual([null, null]);
      expect(driver.thumbAttrs('aria-valuetext')).toEqual(['Mixed', 'Mixed']);
      expect(driver.thumbPositions()).toEqual(['0', '0']);
      // parked thumbs carry no sibling constraint - the full track is announced
      expect(driver.thumbAttrs('aria-valuemin')).toEqual(['0', '0']);
      expect(driver.thumbAttrs('aria-valuemax')).toEqual(['100', '100']);

      expect(driver.fillStart()).toBe('0');
      expect(driver.fillEnd()).toBe('0');
    });

    it('writes a fresh range from the start thumb: committed value plus the default upper bound', () => {
      driver.press('ArrowRight', 0);

      expect(driver.host.value()).toEqual([1, 100]);
      expect(driver.host.mixed()).toBe(false);
      expect(driver.hasAttr('data-mixed')).toBe(false);
    });

    it('writes a fresh range from the end thumb: default lower bound plus the committed value', () => {
      driver.press('End', 1);

      expect(driver.host.value()).toEqual([0, 100]);
      expect(driver.host.mixed()).toBe(false);
    });

    it('honors minDistance for the fresh range', () => {
      driver.host.minDistance.set(10);
      driver.tick();

      driver.press('End', 0);

      expect(driver.host.value()).toEqual([90, 100]);
      expect(driver.host.mixed()).toBe(false);
    });

    it('resolves via a track pointer commit', () => {
      driver.pointer('pointerdown', 30);
      driver.pointer('pointerup', 30);

      expect(driver.host.mixed()).toBe(false);

      const [start, end] = driver.host.value();

      // one end carries the committed 30, the other its default bound
      expect(start === 30 || end === 30).toBe(true);
      expect(start === 0 || end === 100).toBe(true);
    });
  });
});

describe('RangeSliderDirective (mixed contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountRangeSlider(RangeSliderTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set([20, 80]);
        driver.host.mixed.set(true);
        driver.tick();
      },
      rawValue: () => [20, 80],
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.sliderEl(),
      writeValueExternally: () => {
        driver.host.value.set([10, 90]);
        driver.tick();
      },
      externallyWrittenValue: () => [10, 90],
      commit: () => {
        driver.press('ArrowRight', 0);
      },
      // start thumb steps from the effective minimum; the untouched end gets its default bound
      committedValue: () => [1, 100],
      assertMasked: () => {
        expect(driver.thumbAttrs('aria-valuenow')).toEqual([null, null]);
        expect(driver.thumbAttrs('aria-valuetext')).toEqual(['Mixed', 'Mixed']);
        expect(driver.thumbPositions()).toEqual(['0', '0']);
      },
    };
  });
});
