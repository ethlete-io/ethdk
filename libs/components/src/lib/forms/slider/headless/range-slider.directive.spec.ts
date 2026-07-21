import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { RangeSliderValue } from './range-slider.directive';
import { SLIDER_IMPORTS } from '../slider.imports';

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
    <et-range-slider
      [value]="value()"
      [mixed]="mixed()"
      [mixedLabel]="mixedLabel()"
      [minValue]="minValue()"
      [maxValue]="maxValue()"
      [step]="step()"
      [minDistance]="minDistance()"
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
  disabled = signal(false);
}

const TRACK_RECT = { left: 0, width: 100, top: 0, height: 28, right: 100, bottom: 28, x: 0, y: 28 } as DOMRect;

describe('RangeSliderDirective', () => {
  let fixture: ComponentFixture<RangeSliderTestHost>;
  let host: HTMLElement;

  const thumbs = () => Array.from(host.querySelectorAll<HTMLElement>('.et-range-slider-thumb'));
  const track = () => host.querySelector<HTMLElement>('.et-range-slider-interaction')!;

  const keydown = (thumbIndex: number, key: string) => {
    thumbs()[thumbIndex]!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  const pointer = (type: string, clientX: number) => {
    track().dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, button: 0 }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RangeSliderTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(RangeSliderTestHost);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('et-range-slider');
    track().getBoundingClientRect = () => TRACK_RECT;
  });

  it('renders two labelled thumbs whose ARIA bounds reflect the other thumb', () => {
    const [start, end] = thumbs();

    expect(thumbs().length).toBe(2);
    expect(start!.getAttribute('aria-label')).toBe('Minimum');
    expect(end!.getAttribute('aria-label')).toBe('Maximum');
    expect(start!.getAttribute('aria-valuenow')).toBe('20');
    expect(end!.getAttribute('aria-valuenow')).toBe('80');
    expect(start!.getAttribute('aria-valuemin')).toBe('0');
    expect(start!.getAttribute('aria-valuemax')).toBe('80');
    expect(end!.getAttribute('aria-valuemin')).toBe('20');
    expect(end!.getAttribute('aria-valuemax')).toBe('100');
  });

  it('normalizes a reversed value tuple for display', () => {
    fixture.componentInstance.value.set([90, 10]);
    fixture.detectChanges();

    const [start, end] = thumbs();

    expect(start!.getAttribute('aria-valuenow')).toBe('10');
    expect(end!.getAttribute('aria-valuenow')).toBe('90');
  });

  it('keeps thumbs from crossing via the keyboard', () => {
    fixture.componentInstance.value.set([70, 80]);
    fixture.detectChanges();

    keydown(0, 'End');
    expect(fixture.componentInstance.value()).toEqual([80, 80]);

    keydown(1, 'Home');
    expect(fixture.componentInstance.value()).toEqual([80, 80]);
  });

  it('honors minDistance between the thumbs', () => {
    fixture.componentInstance.minDistance.set(10);
    fixture.componentInstance.value.set([60, 80]);
    fixture.detectChanges();

    keydown(0, 'End');
    expect(fixture.componentInstance.value()).toEqual([70, 80]);

    const [start] = thumbs();

    expect(start!.getAttribute('aria-valuemax')).toBe('70');
  });

  it('moves the nearest thumb on a track pointerdown', () => {
    pointer('pointerdown', 30);
    expect(fixture.componentInstance.value()).toEqual([30, 80]);
    pointer('pointerup', 30);

    pointer('pointerdown', 70);
    expect(fixture.componentInstance.value()).toEqual([30, 70]);
    pointer('pointerup', 70);
  });

  it('drags a thumb without letting it cross its sibling', () => {
    pointer('pointerdown', 25);
    expect(fixture.componentInstance.value()).toEqual([25, 80]);

    pointer('pointermove', 95);
    expect(fixture.componentInstance.value()).toEqual([80, 80]);

    pointer('pointerup', 95);
    expect(host.hasAttribute('data-dragging')).toBe(false);
  });

  it('emits nothing while disabled', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    keydown(0, 'ArrowRight');
    pointer('pointerdown', 50);
    expect(fixture.componentInstance.value()).toEqual([20, 80]);
  });

  describe('mixed', () => {
    beforeEach(() => {
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
    });

    it('masks both thumbs: no aria-valuenow, mixed label as valuetext, parked at the track start', () => {
      for (const thumb of thumbs()) {
        expect(thumb.hasAttribute('aria-valuenow')).toBe(false);
        expect(thumb.getAttribute('aria-valuetext')).toBe('Mixed');
        expect(thumb.style.getPropertyValue('--_et-slider-thumb-position')).toBe('0');
        // parked thumbs carry no sibling constraint — the full track is announced
        expect(thumb.getAttribute('aria-valuemin')).toBe('0');
        expect(thumb.getAttribute('aria-valuemax')).toBe('100');
      }

      const fill = host.querySelector<HTMLElement>('.et-range-slider-fill')!;

      expect(fill.style.getPropertyValue('--_et-slider-fill-start')).toBe('0');
      expect(fill.style.getPropertyValue('--_et-slider-fill-end')).toBe('0');
    });

    it('writes a fresh range from the start thumb: committed value plus the default upper bound', () => {
      keydown(0, 'ArrowRight');

      expect(fixture.componentInstance.value()).toEqual([1, 100]);
      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(host.hasAttribute('data-mixed')).toBe(false);
    });

    it('writes a fresh range from the end thumb: default lower bound plus the committed value', () => {
      keydown(1, 'End');

      expect(fixture.componentInstance.value()).toEqual([0, 100]);
      expect(fixture.componentInstance.mixed()).toBe(false);
    });

    it('honors minDistance for the fresh range', () => {
      fixture.componentInstance.minDistance.set(10);
      fixture.detectChanges();

      keydown(0, 'End');

      expect(fixture.componentInstance.value()).toEqual([90, 100]);
      expect(fixture.componentInstance.mixed()).toBe(false);
    });

    it('resolves via a track pointer commit', () => {
      pointer('pointerdown', 30);
      pointer('pointerup', 30);

      expect(fixture.componentInstance.mixed()).toBe(false);

      const [start, end] = fixture.componentInstance.value();

      // one end carries the committed 30, the other its default bound
      expect(start === 30 || end === 30).toBe(true);
      expect(start === 0 || end === 100).toBe(true);
    });
  });
});

describe('RangeSliderDirective (mixed contract)', () => {
  describeMixedStateContract(() => {
    TestBed.configureTestingModule({
      imports: [RangeSliderTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });

    const fixture = TestBed.createComponent(RangeSliderTestHost);

    fixture.detectChanges();

    const hostElement = fixture.nativeElement.querySelector('et-range-slider') as HTMLElement;
    const thumbs = () => Array.from(hostElement.querySelectorAll<HTMLElement>('.et-range-slider-thumb'));

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set([20, 80]);
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
      },
      rawValue: () => [20, 80],
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => hostElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set([10, 90]);
        fixture.detectChanges();
      },
      externallyWrittenValue: () => [10, 90],
      commit: () => {
        thumbs()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        fixture.detectChanges();
      },
      // start thumb steps from the effective minimum; the untouched end gets its default bound
      committedValue: () => [1, 100],
      assertMasked: () => {
        for (const thumb of thumbs()) {
          expect(thumb.hasAttribute('aria-valuenow')).toBe(false);
          expect(thumb.getAttribute('aria-valuetext')).toBe('Mixed');
          expect(thumb.style.getPropertyValue('--_et-slider-thumb-position')).toBe('0');
        }
      },
    };
  });
});
