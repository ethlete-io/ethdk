import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
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
    <et-slider
      [value]="value()"
      [min]="min()"
      [max]="max()"
      [step]="step()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [touched]="touched()"
      (valueChange)="value.set($event)"
      (touchedChange)="touched.set($event)"
    />
  `,
  imports: [SLIDER_IMPORTS],
})
class SliderTestHost {
  value = signal(0);
  touched = signal(false);
  min = signal<number | undefined>(undefined);
  max = signal<number | undefined>(undefined);
  step = signal(1);
  disabled = signal(false);
  readonly = signal(false);
}

const TRACK_RECT = { left: 0, width: 100, top: 0, height: 28, right: 100, bottom: 28, x: 0, y: 28 } as DOMRect;

describe('SliderDirective', () => {
  let fixture: ComponentFixture<SliderTestHost>;
  let host: HTMLElement;

  const thumb = () => host.querySelector<HTMLElement>('.et-slider-thumb')!;
  const track = () => host.querySelector<HTMLElement>('.et-slider-interaction')!;

  const keydown = (key: string) => {
    thumb().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    fixture.detectChanges();
  };

  const pointer = (type: string, clientX: number) => {
    track().dispatchEvent(new MouseEvent(type, { clientX, bubbles: true, button: 0 }));
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
});
