import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
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
      [minValue]="minValue()"
      [maxValue]="maxValue()"
      [step]="step()"
      [minDistance]="minDistance()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
    />
  `,
  imports: [SLIDER_IMPORTS],
})
class RangeSliderTestHost {
  value = signal<RangeSliderValue>([20, 80]);
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
});
