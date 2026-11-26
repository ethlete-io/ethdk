import { Component, computed, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, max, min } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  DEFAULT_SLIDER_LABELS,
  FORM_FIELD_IMPORTS,
  injectSliderLabels,
  provideSliderLabels,
  RangeSliderComponent,
  RangeSliderDirective,
  SLIDER_ERROR_CODES,
  SLIDER_IMPORTS,
  SLIDER_LABELS,
  SLIDER_MARK_VALUE_ATTRIBUTE,
  SLIDER_TOKEN,
  SliderComponent,
  SliderDirective,
  SliderMarks,
  SliderThumbDirective,
  SliderThumbLabelDirective,
  SliderTrackDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const TRACK_RECT = { left: 0, width: 100, top: 0, height: 28, right: 100, bottom: 28, x: 0, y: 0 } as DOMRect;

@Component({
  selector: 'et-scenario-volume-form',
  imports: [FORM_FIELD_IMPORTS, SliderComponent, SliderThumbLabelDirective, FormField],
  template: `
    <et-slider [formField]="settings.volume" [marks]="marks()">
      <et-label>Volume</et-label>
      <et-hint>Between 10 and 50</et-hint>
      <ng-template etSliderThumbLabel let-value>{{ value }}%</ng-template>
    </et-slider>
  `,
})
class VolumeFormComponent {
  model = signal({ volume: 20 });
  marks = signal<SliderMarks>(false);
  settings = form(this.model, (path) => {
    min(path.volume, 10);
    max(path.volume, 50);
  });
}

@Component({
  selector: 'et-scenario-rating-scale',
  imports: [FORM_FIELD_IMPORTS, SliderComponent],
  template: `
    <et-slider [(value)]="score" min="1" max="10" step="3">
      <et-label>Score</et-label>
    </et-slider>
  `,
})
class RatingScaleComponent {
  score = signal(4);
}

@Component({
  selector: 'et-scenario-price-filter',
  imports: [SLIDER_IMPORTS],
  providers: [provideSliderLabels({ minimum: 'Von' })],
  template: `
    <et-range-slider
      [(value)]="price"
      [endLabel]="endLabel()"
      [minDistance]="10"
      [step]="5"
      aria-label="Price"
      minValue="0"
      maxValue="200"
    />
  `,
})
class PriceFilterComponent {
  price = signal<[number, number]>([20, 80]);
  endLabel = signal<string | null>(null);
  labels = injectSliderLabels();
}

@Component({
  selector: 'et-scenario-token-range',
  imports: [RangeSliderComponent],
  providers: [{ provide: SLIDER_LABELS, useValue: () => ({ maximum: 'Obergrenze' }) }],
  template: '<et-range-slider [(value)]="range" />',
})
class TokenRangeComponent {
  range = signal<[number, number]>([0, 100]);
}

@Component({
  selector: 'et-scenario-tempo-readout',
  template: '<output class="tempo-readout">{{ readout() }}</output>',
})
class TempoReadoutComponent {
  private slider = inject(SLIDER_TOKEN);

  readout = computed(() => `${this.slider.thumbValues().join('-')} bpm${this.slider.interactive() ? '' : ' (locked)'}`);
}

@Component({
  selector: 'et-scenario-tempo-control',
  imports: [SliderDirective, SliderTrackDirective, SliderThumbDirective, TempoReadoutComponent],
  template: `
    <div [(value)]="tempo" [disabled]="locked()" [min]="60" [max]="180" class="tempo" etSlider step="10">
      <et-scenario-tempo-readout />
      <div class="tempo-track" etSliderTrack>
        <span [attr.data-et-slider-mark-value]="120" class="tempo-preset">Allegro</span>
        <div class="tempo-thumb" etSliderThumb label="Tempo"></div>
      </div>
    </div>
  `,
})
class TempoControlComponent {
  tempo = signal(90);
  locked = signal(false);
}

@Component({
  selector: 'et-scenario-window-control',
  imports: [RangeSliderDirective, SliderTrackDirective, SliderThumbDirective],
  template: `
    <div [(value)]="window" class="window" etRangeSlider minValue="0" maxValue="24">
      <div class="window-track" etSliderTrack>
        <div etSliderThumb label="Opens"></div>
        <div etSliderThumb label="Closes"></div>
      </div>
    </div>
  `,
})
class WindowControlComponent {
  window = signal<[number, number]>([8, 18]);
}

@Component({
  selector: 'et-scenario-stray-slider-parts',
  imports: [SliderThumbDirective, SliderTrackDirective, SliderThumbLabelDirective],
  template: `
    <div etSliderTrack></div>
    <div etSliderThumb></div>
    <ng-template etSliderThumbLabel let-value>{{ value }}</ng-template>
  `,
})
class StraySliderPartsComponent {}

@Component({
  selector: 'et-scenario-two-thumb-slider',
  imports: [SliderDirective, SliderThumbDirective],
  template: `<div [(value)]="value" etSlider>
    <div etSliderThumb></div>
    <div etSliderThumb></div>
  </div>`,
})
class TwoThumbSliderComponent {
  value = signal(0);
}

@Component({
  selector: 'et-scenario-dense-slider',
  imports: [SliderComponent],
  template: `<et-slider [(value)]="value" [marks]="everyStep" aria-label="Dense" step="0.01" />`,
})
class DenseSliderComponent {
  value = signal(0);
  everyStep: SliderMarks = true;
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const stubTrack = (track: HTMLElement) => {
  track.getBoundingClientRect = () => TRACK_RECT;
};

const pointer = (s: Scenario, target: Element, type: string, clientX: number) => {
  target.dispatchEvent(new MouseEvent(type, { clientX, clientY: 10, bubbles: true, button: 0 }));
  s.tick();
};

const takeError = (s: Scenario, code: number) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => String((entry.error as Error | undefined)?.message).includes(`${code}`));

  const error = index === -1 ? undefined : (s.errors.splice(index, 1)[0]?.error as Error);
  const context = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (context !== -1) s.errors.splice(context, 1);

  return error;
};

describe('forms slider scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  it('binds a signal form field, takes its bounds from the schema and steps by keyboard', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(VolumeFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const thumb = query('[role="slider"]', host);
    const label = query('et-label', host);

    expect(thumb.getAttribute('aria-labelledby')).toBe(label.id);
    expect(thumb.getAttribute('aria-valuemin')).toBe('10');
    expect(thumb.getAttribute('aria-valuemax')).toBe('50');
    expect(thumb.getAttribute('aria-valuenow')).toBe('20');
    expect(thumb.getAttribute('aria-describedby')).toContain(query('et-hint', host).id);
    expect(text(query('.et-slider-thumb-value', host))).toBe('20%');

    thumb.focus();
    s.keydown('ArrowRight', thumb);
    s.tick();
    expect(app.model().volume).toBe(21);

    s.keydown('End', thumb);
    s.tick();
    expect(app.model().volume).toBe(50);
    expect(text(query('.et-slider-thumb-value', host))).toBe('50%');

    s.keydown('PageDown', thumb);
    s.tick();
    expect(app.model().volume).toBe(40);

    s.keydown('Home', thumb);
    s.tick();
    expect(app.model().volume).toBe(10);
    expect(query('.et-slider-fill', host).style.getPropertyValue('--_et-slider-fill-end')).toBe('0');

    app.model.set({ volume: 30 });
    s.tick();
    expect(thumb.getAttribute('aria-valuenow')).toBe('30');
    expect(app.settings.volume().touched()).toBe(false);

    thumb.blur();
    s.tick();
    expect(app.settings.volume().touched()).toBe(true);
  });

  it('reads static string bounds as numbers', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(RatingScaleComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const thumb = query('[role="slider"]', host);

    expect(thumb.getAttribute('aria-valuemin')).toBe('1');
    expect(thumb.getAttribute('aria-valuemax')).toBe('10');
    expect(thumb.getAttribute('aria-valuenow')).toBe('4');

    thumb.focus();
    s.keydown('ArrowRight', thumb);
    s.tick();
    expect(app.score()).toBe(7);

    s.keydown('End', thumb);
    s.tick();
    expect(app.score()).toBe(10);

    s.keydown('Home', thumb);
    s.tick();
    expect(app.score()).toBe(1);

    app.score.set(50);
    s.tick();
    expect(thumb.getAttribute('aria-valuenow')).toBe('10');
  });

  it('drags the thumb along a measured track and commits a labelled tick exactly', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(VolumeFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    app.marks.set([
      { value: 10, label: 'Quiet' },
      { value: 33, label: 'Normal' },
      { value: 50, label: 'Loud' },
    ]);
    s.tick();
    s.flush();

    const track = query('.et-slider-interaction', host);
    const thumb = query('[role="slider"]', host);

    stubTrack(track);

    pointer(s, track, 'pointerdown', 40);
    expect(app.model().volume).toBe(26);
    expect(host.querySelector('.et-slider')?.hasAttribute('data-dragging')).toBe(true);
    expect(document.activeElement).toBe(thumb);

    pointer(s, track, 'pointermove', 80);
    pointer(s, track, 'pointerup', 80);
    s.flush();
    expect(app.model().volume).toBe(42);
    expect(host.querySelector('.et-slider')?.hasAttribute('data-dragging')).toBe(false);

    const marks = queryAll('.et-slider-mark', host);

    expect(marks.map(text)).toEqual(['Quiet', 'Normal', 'Loud']);
    expect(marks.map((mark) => mark.hasAttribute('data-active'))).toEqual([true, true, false]);

    const normal = marks[1]!;

    expect(normal.getAttribute(SLIDER_MARK_VALUE_ATTRIBUTE)).toBe('33');

    pointer(s, query('.et-slider-mark-label', normal), 'pointerdown', 90);
    pointer(s, track, 'pointerup', 90);
    s.flush();

    expect(app.model().volume).toBe(33);
    expect(thumb.getAttribute('aria-valuetext')).toBe('Normal');
  });

  it('names each range thumb from the label set and keeps the thumbs apart', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(PriceFilterComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const [start, end] = queryAll('[role="slider"]', host);

    expect(app.labels()).toEqual({ ...DEFAULT_SLIDER_LABELS, minimum: 'Von' });
    expect(start!.getAttribute('aria-label')).toBe('Von');
    expect(end!.getAttribute('aria-label')).toBe(DEFAULT_SLIDER_LABELS.maximum);
    expect(start!.getAttribute('aria-valuemax')).toBe('70');
    expect(end!.getAttribute('aria-valuemin')).toBe('30');

    app.endLabel.set('Bis');
    s.tick();
    expect(end!.getAttribute('aria-label')).toBe('Bis');

    start!.focus();
    s.keydown('End', start!);
    s.tick();
    expect(app.price()).toEqual([70, 80]);

    s.keydown('ArrowRight', start!);
    s.tick();
    expect(app.price()).toEqual([70, 80]);

    end!.focus();
    s.keydown('PageUp', end!);
    s.tick();
    expect(app.price()).toEqual([70, 130]);

    const track = query('.et-range-slider-interaction', host);

    stubTrack(track);
    pointer(s, track, 'pointerdown', 10);
    pointer(s, track, 'pointerup', 10);
    s.flush();

    expect(app.price()).toEqual([20, 130]);
    expect(document.activeElement).toBe(start);
  });

  it('reads range thumb names from a raw SLIDER_LABELS provider', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TokenRangeComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(queryAll('[role="slider"]', host).map((thumb) => thumb.getAttribute('aria-label'))).toEqual([
      DEFAULT_SLIDER_LABELS.minimum,
      'Obergrenze',
    ]);
  });

  it('builds a custom slider from the headless parts and reads its state through SLIDER_TOKEN', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TempoControlComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const thumb = query('.tempo-thumb', host);
    const track = query('.tempo-track', host);

    expect(thumb.getAttribute('role')).toBe('slider');
    expect(thumb.getAttribute('aria-label')).toBe('Tempo');
    expect(thumb.getAttribute('aria-labelledby')).toBeNull();
    expect(text(query('.tempo-readout', host))).toBe('90 bpm');

    thumb.focus();
    s.keydown('ArrowUp', thumb);
    s.tick();
    expect(app.tempo()).toBe(100);
    expect(text(query('.tempo-readout', host))).toBe('100 bpm');

    stubTrack(track);
    pointer(s, query('.tempo-preset', host), 'pointerdown', 0);
    pointer(s, track, 'pointerup', 0);
    s.flush();
    expect(app.tempo()).toBe(120);

    pointer(s, track, 'pointerdown', 0);
    pointer(s, track, 'pointermove', 50);
    expect(app.tempo()).toBe(120);

    pointer(s, track, 'pointercancel', 50);
    s.flush();
    expect(app.tempo()).toBe(60);

    pointer(s, track, 'pointerdown', 25);
    pointer(s, track, 'pointerup', 25);
    s.flush();
    expect(app.tempo()).toBe(90);

    app.locked.set(true);
    s.tick();

    expect(thumb.getAttribute('tabindex')).toBe('-1');
    expect(thumb.getAttribute('aria-disabled')).toBe('true');
    expect(text(query('.tempo-readout', host))).toBe('90 bpm (locked)');

    s.keydown('ArrowUp', thumb);
    pointer(s, track, 'pointerdown', 0);
    s.flush();
    expect(app.tempo()).toBe(90);
  });

  it('drives a headless two-thumb range with its own thumb names', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(WindowControlComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const [opens, closes] = queryAll('[role="slider"]', host);

    expect([opens!.getAttribute('aria-label'), closes!.getAttribute('aria-label')]).toEqual(['Opens', 'Closes']);

    closes!.focus();
    s.keydown('Home', closes!);
    s.tick();
    expect(app.window()).toEqual([8, 8]);

    s.keydown('ArrowLeft', closes!);
    s.tick();
    expect(app.window()).toEqual([8, 8]);
  });

  it('reports parts placed outside a slider', () => {
    const s = scenario();

    TestBed.createComponent(StraySliderPartsComponent);
    s.tick();
    s.flush();

    expect(takeError(s, SLIDER_ERROR_CODES.TRACK_OUTSIDE_SLIDER)?.message).toContain(
      'An [etSliderTrack] must be placed inside',
    );
    expect(takeError(s, SLIDER_ERROR_CODES.THUMB_OUTSIDE_SLIDER)?.message).toContain(
      'An [etSliderThumb] must be placed inside',
    );
    expect(takeError(s, SLIDER_ERROR_CODES.THUMB_LABEL_OUTSIDE_SLIDER)?.message).toContain(
      'ng-template[etSliderThumbLabel] must be placed inside',
    );
  });

  it('reports a single slider with two thumbs', () => {
    const s = scenario();

    TestBed.createComponent(TwoThumbSliderComponent);
    s.tick();
    s.flush();

    expect(takeError(s, SLIDER_ERROR_CODES.THUMB_COUNT_MISMATCH)?.message).toContain('found 2');
  });

  it('reports generated marks too dense to render', () => {
    const s = scenario();

    TestBed.createComponent(DenseSliderComponent);

    expect(() => s.tick()).toThrow(`ET${SLIDER_ERROR_CODES.MARKS_TOO_DENSE}`);
    s.allow('frames', 'the throw aborts the render that would run the queued frame');
  });
});
