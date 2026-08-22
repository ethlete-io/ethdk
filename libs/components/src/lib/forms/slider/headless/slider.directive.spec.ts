import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { mountSlider, SliderDriver } from '../../testing/slider-driver';
import { SLIDER_IMPORTS } from '../slider.imports';
import { SliderMarks, SliderOrientation } from './slider.tokens';

@Component({
  template: `
    <et-slider
      [value]="value()"
      [mixed]="mixed()"
      [mixedLabel]="mixedLabel()"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [orientation]="orientation()"
      [marks]="marks()"
      [snapToMarks]="snapToMarks()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [touched]="touched()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      (touchedChange)="touched.set($event)"
    >
      <et-label>Test label</et-label>
    </et-slider>
  `,
  imports: [SLIDER_IMPORTS, LabelDirective],
})
class SliderTestHost {
  value = signal(0);
  mixed = signal(false);
  mixedLabel = signal('Mixed');
  touched = signal(false);
  min = signal<number | undefined>(undefined);
  max = signal<number | undefined>(undefined);
  step = signal(1);
  orientation = signal<SliderOrientation>('horizontal');
  marks = signal<SliderMarks>(false);
  snapToMarks = signal(false);
  disabled = signal(false);
  readonly = signal(false);
}

describe('SliderDirective', () => {
  let driver: SliderDriver<SliderTestHost>;

  beforeEach(() => {
    driver = mountSlider(SliderTestHost);
  });

  it('renders a slider thumb with the ARIA slider semantics', () => {
    expect(driver.thumbAttr('role')).toBe('slider');
    expect(driver.thumbAttr('tabindex')).toBe('0');
    expect(driver.thumbAttr('aria-orientation')).toBe('horizontal');
    expect(driver.thumbAttr('aria-valuemin')).toBe('0');
    expect(driver.thumbAttr('aria-valuemax')).toBe('100');
    expect(driver.thumbAttr('aria-valuenow')).toBe('0');
  });

  it('positions the thumb and fill from the value', () => {
    driver.host.value.set(25);
    driver.tick();

    expect(driver.thumbPosition()).toBe('25');
    expect(driver.fillEnd()).toBe('25');
  });

  it('displays the value clamped and snapped to the step grid', () => {
    driver.host.step.set(10);
    driver.host.value.set(37);
    driver.tick();

    expect(driver.thumbAttr('aria-valuenow')).toBe('40');

    driver.host.value.set(999);
    driver.tick();

    expect(driver.thumbAttr('aria-valuenow')).toBe('100');
  });

  it('steps with the keyboard and clamps at the bounds', () => {
    driver.press('ArrowRight');
    expect(driver.host.value()).toBe(1);

    driver.press('ArrowUp');
    expect(driver.host.value()).toBe(2);

    driver.press('ArrowLeft');
    driver.press('ArrowDown');
    driver.press('ArrowDown');
    expect(driver.host.value()).toBe(0);

    driver.press('PageUp');
    expect(driver.host.value()).toBe(10);

    driver.press('PageDown');
    expect(driver.host.value()).toBe(0);

    driver.press('End');
    expect(driver.host.value()).toBe(100);

    driver.press('Home');
    expect(driver.host.value()).toBe(0);
  });

  it('respects custom bounds and step for the keyboard model', () => {
    driver.host.min.set(10);
    driver.host.max.set(20);
    driver.host.step.set(5);
    driver.host.value.set(10);
    driver.tick();

    expect(driver.thumbAttr('aria-valuemin')).toBe('10');
    expect(driver.thumbAttr('aria-valuemax')).toBe('20');

    driver.press('ArrowRight');
    expect(driver.host.value()).toBe(15);

    driver.press('PageUp');
    expect(driver.host.value()).toBe(20);
  });

  it('commits the value under a track pointerdown and drags it along', () => {
    driver.pointer('pointerdown', 30);
    expect(driver.host.value()).toBe(30);
    expect(driver.hasAttr('data-dragging')).toBe(true);

    driver.pointer('pointermove', 62);
    expect(driver.host.value()).toBe(62);

    driver.pointer('pointerup', 62);
    expect(driver.hasAttr('data-dragging')).toBe(false);

    // no longer dragging - moves are ignored
    driver.pointer('pointermove', 90);
    expect(driver.host.value()).toBe(62);
  });

  it('reverts to the pressed value when the browser takes the drag away', () => {
    driver.pointer('pointerdown', 30);
    driver.pointer('pointermove', 62);
    expect(driver.host.value()).toBe(62);

    driver.pointer('pointercancel', 62);
    expect(driver.host.value()).toBe(30);
    expect(driver.hasAttr('data-dragging')).toBe(false);

    // the gesture is over - later moves belong to no drag
    driver.pointer('pointermove', 90);
    expect(driver.host.value()).toBe(30);
  });

  it('ignores interaction while disabled or readonly', () => {
    driver.host.disabled.set(true);
    driver.tick();

    driver.press('ArrowRight');
    driver.pointer('pointerdown', 50);
    expect(driver.host.value()).toBe(0);
    expect(driver.thumbAttr('tabindex')).toBe('-1');

    driver.host.disabled.set(false);
    driver.host.readonly.set(true);
    driver.tick();

    driver.press('ArrowRight');
    driver.pointer('pointerdown', 50);
    expect(driver.host.value()).toBe(0);
    expect(driver.thumbAttr('tabindex')).toBe('0');
    expect(driver.thumbAttr('aria-readonly')).toBe('true');
  });

  it('marks the control touched on blur', () => {
    expect(driver.host.touched()).toBe(false);

    driver.blurThumb();

    expect(driver.host.touched()).toBe(true);
  });

  describe('vertical orientation', () => {
    beforeEach(() => {
      driver.host.orientation.set('vertical');
      driver.tick();
      driver.stubTrack('vertical');
    });

    it('exposes the orientation on the host and the thumb', () => {
      expect(driver.attr('data-orientation')).toBe('vertical');
      expect(driver.thumbAttr('aria-orientation')).toBe('vertical');
    });

    it('swaps the blocked touch axis on the track and the thumb', () => {
      expect(driver.trackTouchAction()).toBe('pan-x');
      expect(driver.thumbTouchActions()).toEqual(['pan-x']);

      driver.host.orientation.set('horizontal');
      driver.tick();

      expect(driver.trackTouchAction()).toBe('pan-y');
      expect(driver.thumbTouchActions()).toEqual(['pan-y']);
    });

    it('maps pointer positions bottom→up', () => {
      driver.pointer('pointerdown', 0, 100);
      expect(driver.host.value()).toBe(0);

      driver.pointer('pointermove', 0, 70);
      expect(driver.host.value()).toBe(30);

      driver.pointer('pointerup', 0, 0);
      expect(driver.host.value()).toBe(100);
    });

    it('keeps ArrowUp/ArrowDown incrementing and decrementing', () => {
      driver.press('ArrowUp');
      expect(driver.host.value()).toBe(1);

      driver.press('ArrowDown');
      expect(driver.host.value()).toBe(0);

      driver.press('End');
      expect(driver.host.value()).toBe(100);
    });
  });

  describe('marks', () => {
    it('renders no ticks by default', () => {
      expect(driver.markEls()).toHaveLength(0);
      expect(driver.hasAttr('data-mark-labels')).toBe(false);
    });

    it('renders a tick per step and flags the ones inside the fill', () => {
      driver.host.step.set(25);
      driver.host.marks.set(true);
      driver.host.value.set(50);
      driver.tick();

      expect(driver.markPositions()).toEqual(['0', '25', '50', '75', '100']);
      expect(driver.markActives()).toEqual([true, true, true, false, false]);
    });

    it('renders labelled ticks aria-hidden and flags the host so the labels get room', () => {
      driver.host.marks.set([{ value: 0, label: 'Low' }, { value: 50 }, { value: 100, label: 'High' }]);
      driver.tick();

      expect(driver.marksEl()!.getAttribute('aria-hidden')).toBe('true');
      expect(driver.markLabels()).toEqual(['Low', '', 'High']);
      expect(driver.hasAttr('data-mark-labels')).toBe(true);
    });

    it('activates no tick while mixed', () => {
      driver.host.marks.set(true);
      driver.host.step.set(50);
      driver.host.value.set(100);
      driver.host.mixed.set(true);
      driver.tick();

      expect(driver.markActives()).not.toContain(true);
    });

    it('commits the exact stop when the pointer goes down on a tick', () => {
      driver.host.marks.set([{ value: 33 }]);
      driver.tick();

      driver.pointerOnMark(0);

      expect(driver.host.value()).toBe(33);
    });

    it('keeps a tick press on the tick even when the mark is off the step grid', () => {
      driver.host.step.set(10);
      driver.host.marks.set([{ value: 25, label: 'quarter' }, { value: 50 }]);
      driver.tick();

      driver.pointerOnMark(0);

      expect(driver.host.value()).toBe(25);
      expect(driver.thumbAttr('aria-valuenow')).toBe('25');
    });

    it('still snaps a press on the bare track onto the step grid', () => {
      driver.host.step.set(10);
      driver.host.marks.set([{ value: 25 }]);
      driver.tick();

      driver.pointer('pointerdown', 26);

      expect(driver.host.value()).toBe(30);
    });

    describe('snapToMarks', () => {
      beforeEach(() => {
        driver.host.marks.set([
          { value: 0, label: 'Low' },
          { value: 20, label: 'Medium' },
          { value: 80, label: 'High' },
        ]);
        driver.host.snapToMarks.set(true);
        driver.tick();
      });

      it('displays the nearest mark instead of the step grid', () => {
        driver.host.value.set(45);
        driver.tick();

        expect(driver.thumbAttr('aria-valuenow')).toBe('20');
      });

      it('announces the mark label as the accessible value', () => {
        driver.host.value.set(80);
        driver.tick();

        expect(driver.thumbAttr('aria-valuetext')).toBe('High');

        driver.host.snapToMarks.set(false);
        driver.tick();

        expect(driver.thumbAttr('aria-valuetext')).toBeNull();
      });

      it('steps from mark to mark with the keyboard', () => {
        driver.press('ArrowRight');
        expect(driver.host.value()).toBe(20);

        driver.press('ArrowUp');
        expect(driver.host.value()).toBe(80);

        driver.press('ArrowUp');
        expect(driver.host.value()).toBe(80);

        driver.press('PageDown');
        expect(driver.host.value()).toBe(0);

        driver.press('End');
        expect(driver.host.value()).toBe(80);
      });

      it('snaps pointer commits onto the marks', () => {
        driver.pointer('pointerdown', 45);
        expect(driver.host.value()).toBe(20);

        driver.pointer('pointermove', 60);
        expect(driver.host.value()).toBe(80);

        driver.pointer('pointerup', 60);
      });
    });
  });

  describe('mixed', () => {
    beforeEach(() => {
      driver.host.value.set(40);
      driver.host.mixed.set(true);
      driver.tick();
    });

    it('removes aria-valuenow, announces the mixed label and parks the thumb at the track start', () => {
      expect(driver.thumbAttr('aria-valuenow')).toBeNull();
      expect(driver.thumbAttr('aria-valuetext')).toBe('Mixed');
      expect(driver.thumbPosition()).toBe('0');
      expect(driver.fillEnd()).toBe('0');

      driver.host.mixedLabel.set('Different volumes');
      driver.tick();

      expect(driver.thumbAttr('aria-valuetext')).toBe('Different volumes');
    });

    it('starts the first keyboard step from the effective minimum', () => {
      driver.host.min.set(10);
      driver.tick();

      driver.press('ArrowRight');

      expect(driver.host.value()).toBe(11);
      expect(driver.host.mixed()).toBe(false);
      expect(driver.thumbAttr('aria-valuenow')).toBe('11');
      expect(driver.thumbAttr('aria-valuetext')).toBeNull();
    });

    it('resolves on Home even though the committed value equals the effective minimum', () => {
      driver.press('Home');

      expect(driver.host.value()).toBe(0);
      expect(driver.host.mixed()).toBe(false);
    });

    it('resolves on a pointer commit that lands on the hidden raw value', () => {
      driver.pointer('pointerdown', 40);
      driver.pointer('pointerup', 40);

      expect(driver.host.value()).toBe(40);
      expect(driver.host.mixed()).toBe(false);
      expect(driver.hasAttr('data-mixed')).toBe(false);
    });

    it('stays mixed while disabled or readonly interactions are ignored', () => {
      driver.host.readonly.set(true);
      driver.tick();

      driver.press('ArrowRight');
      driver.pointer('pointerdown', 50);

      expect(driver.host.value()).toBe(40);
      expect(driver.host.mixed()).toBe(true);
    });
  });
});

describe('SliderDirective (mixed contract)', () => {
  describeMixedStateContract(() => {
    const driver = mountSlider(SliderTestHost);

    return {
      enterMixed: () => {
        driver.host.value.set(40);
        driver.host.mixed.set(true);
        driver.tick();
      },
      rawValue: () => 40,
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.sliderEl(),
      writeValueExternally: () => {
        driver.host.value.set(70);
        driver.tick();
      },
      externallyWrittenValue: () => 70,
      commit: () => {
        driver.press('ArrowRight');
      },
      // the first keyboard step starts from the effective minimum (0), not the hidden 40
      committedValue: () => 1,
      assertMasked: () => {
        expect(driver.thumbAttr('aria-valuenow')).toBeNull();
        expect(driver.thumbAttr('aria-valuetext')).toBe('Mixed');
        expect(driver.thumbPosition()).toBe('0');
      },
    };
  });
});
