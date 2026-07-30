import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { LabelDirective } from '../../form-field/headless';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { SLIDER_IMPORTS } from '../slider.imports';
import { SliderMarks, SliderOrientation } from './slider.tokens';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: {
        default: '255 0 0',
        hover: '255 76 76',
        focus: '255 76 76',
        active: '198 0 0',
        disabled: '128 32 32',
      },
      onColor: {
        default: '0 0 0',
        disabled: '48 0 0',
      },
    },
  },
] as const;

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

const TRACK_RECT = { left: 0, width: 100, top: 0, height: 28, right: 100, bottom: 28, x: 0, y: 28 } as DOMRect;
const VERTICAL_TRACK_RECT = { left: 0, width: 28, top: 0, height: 100, right: 28, bottom: 100, x: 0, y: 0 } as DOMRect;

describe('SliderDirective', () => {
  let fixture: ComponentFixture<SliderTestHost>;
  let host: HTMLElement;

  const thumb = () => host.querySelector<HTMLElement>('.et-slider-thumb')!;
  const track = () => host.querySelector<HTMLElement>('.et-slider-interaction')!;

  const keydown = (key: string) => {
    thumb().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  const marks = () => Array.from(host.querySelectorAll<HTMLElement>('.et-slider-mark'));

  const pointer = (type: string, clientX: number, clientY = 0) => {
    track().dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true, button: 0 }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SliderTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(SliderTestHost);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('et-slider');
    track().getBoundingClientRect = () => TRACK_RECT;
  });

  it('renders a slider thumb with the ARIA slider semantics', () => {
    expect(thumb().getAttribute('role')).toBe('slider');
    expect(thumb().getAttribute('tabindex')).toBe('0');
    expect(thumb().getAttribute('aria-orientation')).toBe('horizontal');
    expect(thumb().getAttribute('aria-valuemin')).toBe('0');
    expect(thumb().getAttribute('aria-valuemax')).toBe('100');
    expect(thumb().getAttribute('aria-valuenow')).toBe('0');
  });

  it('positions the thumb and fill from the value', () => {
    fixture.componentInstance.value.set(25);
    fixture.detectChanges();

    expect(thumb().style.getPropertyValue('--_et-slider-thumb-position')).toBe('25');
    expect(host.querySelector<HTMLElement>('.et-slider-fill')!.style.getPropertyValue('--_et-slider-fill-end')).toBe(
      '25',
    );
  });

  it('displays the value clamped and snapped to the step grid', () => {
    fixture.componentInstance.step.set(10);
    fixture.componentInstance.value.set(37);
    fixture.detectChanges();

    expect(thumb().getAttribute('aria-valuenow')).toBe('40');

    fixture.componentInstance.value.set(999);
    fixture.detectChanges();

    expect(thumb().getAttribute('aria-valuenow')).toBe('100');
  });

  it('steps with the keyboard and clamps at the bounds', () => {
    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBe(1);

    keydown('ArrowUp');
    expect(fixture.componentInstance.value()).toBe(2);

    keydown('ArrowLeft');
    keydown('ArrowDown');
    keydown('ArrowDown');
    expect(fixture.componentInstance.value()).toBe(0);

    keydown('PageUp');
    expect(fixture.componentInstance.value()).toBe(10);

    keydown('PageDown');
    expect(fixture.componentInstance.value()).toBe(0);

    keydown('End');
    expect(fixture.componentInstance.value()).toBe(100);

    keydown('Home');
    expect(fixture.componentInstance.value()).toBe(0);
  });

  it('respects custom bounds and step for the keyboard model', () => {
    fixture.componentInstance.min.set(10);
    fixture.componentInstance.max.set(20);
    fixture.componentInstance.step.set(5);
    fixture.componentInstance.value.set(10);
    fixture.detectChanges();

    expect(thumb().getAttribute('aria-valuemin')).toBe('10');
    expect(thumb().getAttribute('aria-valuemax')).toBe('20');

    keydown('ArrowRight');
    expect(fixture.componentInstance.value()).toBe(15);

    keydown('PageUp');
    expect(fixture.componentInstance.value()).toBe(20);
  });

  it('commits the value under a track pointerdown and drags it along', () => {
    pointer('pointerdown', 30);
    expect(fixture.componentInstance.value()).toBe(30);
    expect(host.hasAttribute('data-dragging')).toBe(true);

    pointer('pointermove', 62);
    expect(fixture.componentInstance.value()).toBe(62);

    pointer('pointerup', 62);
    expect(host.hasAttribute('data-dragging')).toBe(false);

    // no longer dragging — moves are ignored
    pointer('pointermove', 90);
    expect(fixture.componentInstance.value()).toBe(62);
  });

  it('ignores interaction while disabled or readonly', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    keydown('ArrowRight');
    pointer('pointerdown', 50);
    expect(fixture.componentInstance.value()).toBe(0);
    expect(thumb().getAttribute('tabindex')).toBe('-1');

    fixture.componentInstance.disabled.set(false);
    fixture.componentInstance.readonly.set(true);
    fixture.detectChanges();

    keydown('ArrowRight');
    pointer('pointerdown', 50);
    expect(fixture.componentInstance.value()).toBe(0);
    expect(thumb().getAttribute('tabindex')).toBe('0');
    expect(thumb().getAttribute('aria-readonly')).toBe('true');
  });

  it('marks the control touched on blur', () => {
    expect(fixture.componentInstance.touched()).toBe(false);

    thumb().dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(fixture.componentInstance.touched()).toBe(true);
  });

  describe('vertical orientation', () => {
    beforeEach(() => {
      fixture.componentInstance.orientation.set('vertical');
      fixture.detectChanges();
      track().getBoundingClientRect = () => VERTICAL_TRACK_RECT;
    });

    it('exposes the orientation on the host and the thumb', () => {
      expect(host.getAttribute('data-orientation')).toBe('vertical');
      expect(thumb().getAttribute('aria-orientation')).toBe('vertical');
    });

    it('swaps the blocked touch axis on the track and the thumb', () => {
      expect(track().style.touchAction).toBe('pan-x');
      expect(thumb().style.touchAction).toBe('pan-x');

      fixture.componentInstance.orientation.set('horizontal');
      fixture.detectChanges();

      expect(track().style.touchAction).toBe('pan-y');
      expect(thumb().style.touchAction).toBe('pan-y');
    });

    it('maps pointer positions bottom→up', () => {
      pointer('pointerdown', 0, 100);
      expect(fixture.componentInstance.value()).toBe(0);

      pointer('pointermove', 0, 70);
      expect(fixture.componentInstance.value()).toBe(30);

      pointer('pointerup', 0, 0);
      expect(fixture.componentInstance.value()).toBe(100);
    });

    it('keeps ArrowUp/ArrowDown incrementing and decrementing', () => {
      keydown('ArrowUp');
      expect(fixture.componentInstance.value()).toBe(1);

      keydown('ArrowDown');
      expect(fixture.componentInstance.value()).toBe(0);

      keydown('End');
      expect(fixture.componentInstance.value()).toBe(100);
    });
  });

  describe('marks', () => {
    it('renders no ticks by default', () => {
      expect(marks().length).toBe(0);
      expect(host.hasAttribute('data-mark-labels')).toBe(false);
    });

    it('renders a tick per step and flags the ones inside the fill', () => {
      fixture.componentInstance.step.set(25);
      fixture.componentInstance.marks.set(true);
      fixture.componentInstance.value.set(50);
      fixture.detectChanges();

      expect(marks().map((mark) => mark.style.getPropertyValue('--_et-slider-mark-position'))).toEqual([
        '0',
        '25',
        '50',
        '75',
        '100',
      ]);
      expect(marks().map((mark) => mark.hasAttribute('data-active'))).toEqual([true, true, true, false, false]);
    });

    it('renders labelled ticks aria-hidden and flags the host so the labels get room', () => {
      fixture.componentInstance.marks.set([{ value: 0, label: 'Low' }, { value: 50 }, { value: 100, label: 'High' }]);
      fixture.detectChanges();

      expect(host.querySelector('.et-slider-marks')!.getAttribute('aria-hidden')).toBe('true');
      expect(marks().map((mark) => mark.textContent)).toEqual(['Low', '', 'High']);
      expect(host.hasAttribute('data-mark-labels')).toBe(true);
    });

    it('activates no tick while mixed', () => {
      fixture.componentInstance.marks.set(true);
      fixture.componentInstance.step.set(50);
      fixture.componentInstance.value.set(100);
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();

      expect(marks().some((mark) => mark.hasAttribute('data-active'))).toBe(false);
    });

    it('commits the exact stop when the pointer goes down on a tick', () => {
      fixture.componentInstance.marks.set([{ value: 33 }]);
      fixture.detectChanges();

      marks()[0]!.dispatchEvent(new MouseEvent('pointerdown', { clientX: 0, bubbles: true, button: 0 }));
      fixture.detectChanges();

      expect(fixture.componentInstance.value()).toBe(33);
    });

    describe('snapToMarks', () => {
      beforeEach(() => {
        fixture.componentInstance.marks.set([
          { value: 0, label: 'Low' },
          { value: 20, label: 'Medium' },
          { value: 80, label: 'High' },
        ]);
        fixture.componentInstance.snapToMarks.set(true);
        fixture.detectChanges();
      });

      it('displays the nearest mark instead of the step grid', () => {
        fixture.componentInstance.value.set(45);
        fixture.detectChanges();

        expect(thumb().getAttribute('aria-valuenow')).toBe('20');
      });

      it('announces the mark label as the accessible value', () => {
        fixture.componentInstance.value.set(80);
        fixture.detectChanges();

        expect(thumb().getAttribute('aria-valuetext')).toBe('High');

        fixture.componentInstance.snapToMarks.set(false);
        fixture.detectChanges();

        expect(thumb().hasAttribute('aria-valuetext')).toBe(false);
      });

      it('steps from mark to mark with the keyboard', () => {
        keydown('ArrowRight');
        expect(fixture.componentInstance.value()).toBe(20);

        keydown('ArrowUp');
        expect(fixture.componentInstance.value()).toBe(80);

        keydown('ArrowUp');
        expect(fixture.componentInstance.value()).toBe(80);

        keydown('PageDown');
        expect(fixture.componentInstance.value()).toBe(0);

        keydown('End');
        expect(fixture.componentInstance.value()).toBe(80);
      });

      it('snaps pointer commits onto the marks', () => {
        pointer('pointerdown', 45);
        expect(fixture.componentInstance.value()).toBe(20);

        pointer('pointermove', 60);
        expect(fixture.componentInstance.value()).toBe(80);

        pointer('pointerup', 60);
      });
    });
  });

  describe('mixed', () => {
    beforeEach(() => {
      fixture.componentInstance.value.set(40);
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
    });

    it('removes aria-valuenow, announces the mixed label and parks the thumb at the track start', () => {
      expect(thumb().hasAttribute('aria-valuenow')).toBe(false);
      expect(thumb().getAttribute('aria-valuetext')).toBe('Mixed');
      expect(thumb().style.getPropertyValue('--_et-slider-thumb-position')).toBe('0');
      expect(host.querySelector<HTMLElement>('.et-slider-fill')!.style.getPropertyValue('--_et-slider-fill-end')).toBe(
        '0',
      );

      fixture.componentInstance.mixedLabel.set('Different volumes');
      fixture.detectChanges();

      expect(thumb().getAttribute('aria-valuetext')).toBe('Different volumes');
    });

    it('starts the first keyboard step from the effective minimum', () => {
      fixture.componentInstance.min.set(10);
      fixture.detectChanges();

      keydown('ArrowRight');

      expect(fixture.componentInstance.value()).toBe(11);
      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(thumb().getAttribute('aria-valuenow')).toBe('11');
      expect(thumb().hasAttribute('aria-valuetext')).toBe(false);
    });

    it('resolves on Home even though the committed value equals the effective minimum', () => {
      keydown('Home');

      expect(fixture.componentInstance.value()).toBe(0);
      expect(fixture.componentInstance.mixed()).toBe(false);
    });

    it('resolves on a pointer commit that lands on the hidden raw value', () => {
      pointer('pointerdown', 40);
      pointer('pointerup', 40);

      expect(fixture.componentInstance.value()).toBe(40);
      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(host.hasAttribute('data-mixed')).toBe(false);
    });

    it('stays mixed while disabled or readonly interactions are ignored', () => {
      fixture.componentInstance.readonly.set(true);
      fixture.detectChanges();

      keydown('ArrowRight');
      pointer('pointerdown', 50);

      expect(fixture.componentInstance.value()).toBe(40);
      expect(fixture.componentInstance.mixed()).toBe(true);
    });
  });
});

describe('SliderDirective (mixed contract)', () => {
  describeMixedStateContract(() => {
    TestBed.configureTestingModule({
      imports: [SliderTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(SliderTestHost);

    fixture.detectChanges();

    const hostElement = fixture.nativeElement.querySelector('et-slider') as HTMLElement;
    const thumb = () => hostElement.querySelector<HTMLElement>('.et-slider-thumb')!;

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set(40);
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
      },
      rawValue: () => 40,
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => hostElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set(70);
        fixture.detectChanges();
      },
      externallyWrittenValue: () => 70,
      commit: () => {
        thumb().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
      },
      // the first keyboard step starts from the effective minimum (0), not the hidden 40
      committedValue: () => 1,
      assertMasked: () => {
        expect(thumb().hasAttribute('aria-valuenow')).toBe(false);
        expect(thumb().getAttribute('aria-valuetext')).toBe('Mixed');
        expect(thumb().style.getPropertyValue('--_et-slider-thumb-position')).toBe('0');
      },
    };
  });
});
