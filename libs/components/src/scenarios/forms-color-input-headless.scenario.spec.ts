import { Component, inject, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import {
  COLOR_INPUT_ERROR_CODES,
  COLOR_INPUT_TOKEN,
  ColorInputDirective,
  ColorPickerAreaDirective,
  ColorPickerChannelDirective,
  ColorPickerPanelComponent,
  ColorPickerSurfaceDirective,
  ColorPickerTriggerDirective,
  DEFAULT_COLOR_INPUT_LABELS,
  injectColorInputLabels,
  provideColorInputLabels,
  provideOverlay,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-color-readout',
  template: '<output class="readout">{{ colorInput.value() ?? "none" }} / {{ colorInput.displayValue() }}</output>',
})
class ColorReadoutComponent {
  colorInput = inject(COLOR_INPUT_TOKEN);
}

@Component({
  selector: 'et-scenario-hue-picker',
  styles: ['et-scrollbar { display: block; }'],
  encapsulation: ViewEncapsulation.None,
  imports: [
    ColorInputDirective,
    ColorPickerTriggerDirective,
    ColorPickerSurfaceDirective,
    ColorPickerAreaDirective,
    ColorPickerChannelDirective,
    ColorReadoutComponent,
  ],
  providers: [provideColorInputLabels({ hue: 'Farbton', saturation: 'Sättigung' })],
  template: `
    <div [(value)]="color" [(pickerOpen)]="open" aria-label="Team color" etColorInput>
      <button class="hue-trigger" etColorPickerTrigger>{{ color() ?? 'none' }}</button>
      <ng-template etColorPickerSurface let-input let-close="close">
        <div #area="etColorPickerArea" class="hue-area" etColorPickerArea>
          <input [attr.aria-label]="labels().saturation" class="hue-saturation" etColorPickerChannel="saturation" />
        </div>
        <span class="hue-thumb">{{ area.hueColor() }} {{ area.saturationPercent() }}</span>
        <input [attr.aria-label]="labels().hue" class="hue-slider" etColorPickerChannel="hue" />
        <et-scenario-color-readout />
        <button (click)="input.value.set('#00ff00'); close()" class="hue-green" type="button">Green</button>
      </ng-template>
    </div>
  `,
})
class HuePickerComponent {
  color = signal<string | null>('#ff0000');
  open = signal(false);
  labels = injectColorInputLabels();
  colorInput = viewChild.required(ColorInputDirective);
}

@Component({
  selector: 'et-scenario-styled-picker',
  styles: ['et-scrollbar { display: block; }'],
  encapsulation: ViewEncapsulation.None,
  imports: [ColorInputDirective, ColorPickerTriggerDirective, ColorPickerSurfaceDirective, ColorPickerPanelComponent],
  template: `
    <div [(value)]="color" etColorInput readonly>
      <button class="styled-trigger" aria-label="Brand" etColorPickerTrigger>Brand</button>
      <ng-template etColorPickerSurface><et-color-picker-panel /></ng-template>
    </div>
  `,
})
class StyledPickerComponent {
  color = signal<string | null>('#123456');
}

@Component({
  selector: 'et-scenario-surfaceless-color',
  imports: [ColorInputDirective, ColorPickerTriggerDirective],
  template: '<div etColorInput><button class="bare-trigger" etColorPickerTrigger>Open</button></div>',
})
class SurfacelessColorComponent {}

@Component({
  selector: 'et-scenario-stray-color-trigger',
  imports: [ColorPickerTriggerDirective],
  template: '<button etColorPickerTrigger>Lost</button>',
})
class StrayTriggerComponent {}

@Component({
  selector: 'et-scenario-stray-color-surface',
  imports: [ColorPickerSurfaceDirective],
  template: '<ng-template etColorPickerSurface>Lost</ng-template>',
})
class StraySurfaceComponent {}

@Component({
  selector: 'et-scenario-stray-color-area',
  imports: [ColorPickerAreaDirective],
  template: '<div etColorPickerArea>Lost</div>',
})
class StrayAreaComponent {}

@Component({
  selector: 'et-scenario-stray-color-channel',
  imports: [ColorPickerChannelDirective],
  template: '<input etColorPickerChannel="hue" />',
})
class StrayChannelComponent {}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
  s.flush();
};

const slide = (s: Scenario, input: HTMLInputElement, value: number) => {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

const takeRuntimeError = (s: Scenario, code: number) => {
  s.expectError(`ET${code}`);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

describe('forms color input headless scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('composes a custom picker from the headless directives and reads the control from a child', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HuePickerComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    settle(s);

    const trigger = query<HTMLButtonElement>('.hue-trigger', host);

    expect(trigger.getAttribute('aria-label')).toBe('Team color');
    expect(trigger.type).toBe('button');
    expect(app.labels().hue).toBe('Farbton');
    expect(app.labels().alpha).toBe(DEFAULT_COLOR_INPUT_LABELS.alpha);

    trigger.click();
    settle(s);

    expect(app.open()).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(query('.hue-slider').getAttribute('aria-label')).toBe('Farbton');
    expect(query('.hue-saturation').getAttribute('aria-label')).toBe('Sättigung');
    expect(query<HTMLInputElement>('.hue-slider').max).toBe('360');
    expect(text(query('.hue-thumb'))).toBe('hsl(0 100% 50%) 100');
    expect(text(query('.readout'))).toBe('#ff0000 / #ff0000');

    slide(s, query<HTMLInputElement>('.hue-slider'), 240);
    expect(app.color()).toBe('#0000ff');
    expect(query('.hue-slider').getAttribute('aria-valuetext')).toBe('240°');

    slide(s, query<HTMLInputElement>('.hue-saturation'), 50);
    expect(app.color()).toBe('#8080ff');
    expect(text(query('.hue-thumb'))).toBe('hsl(240 100% 50%) 50');

    query('.hue-green').click();
    settle(s);
    expect(app.color()).toBe('#00ff00');
    expect(app.open()).toBe(false);
    expect(app.colorInput().touched()).toBe(true);

    app.open.set(true);
    settle(s);
    expect(text(query('.readout'))).toBe('#00ff00 / #00ff00');
    app.colorInput().closePicker();
    settle(s);
    expect(document.querySelector('.readout')).toBeNull();
  });

  it('opens the styled panel read-only from a readonly headless control', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StyledPickerComponent);
    const host = fixture.nativeElement as HTMLElement;

    settle(s);

    const trigger = query<HTMLButtonElement>('.styled-trigger', host);

    expect(trigger.getAttribute('aria-readonly')).toBe('true');
    expect(trigger.getAttribute('aria-label')).toBe('Brand');
    trigger.click();
    settle(s);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('et-color-picker-panel')).toBeNull();
  });

  it('reports a runtime error when a color input opens without a surface', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfacelessColorComponent);

    settle(s);
    expect(() => {
      query('.bare-trigger', fixture.nativeElement as HTMLElement).click();
      settle(s);
    }).toThrow(`ET${COLOR_INPUT_ERROR_CODES.MISSING_SURFACE}`);
  });

  it.each([
    ['a trigger', StrayTriggerComponent, COLOR_INPUT_ERROR_CODES.TRIGGER_OUTSIDE_COLOR_INPUT],
    ['a surface', StraySurfaceComponent, COLOR_INPUT_ERROR_CODES.SURFACE_OUTSIDE_COLOR_INPUT],
    ['an area', StrayAreaComponent, COLOR_INPUT_ERROR_CODES.AREA_OUTSIDE_COLOR_INPUT],
    ['a channel', StrayChannelComponent, COLOR_INPUT_ERROR_CODES.TRACK_OUTSIDE_COLOR_INPUT],
  ])('reports a runtime error for %s outside a color input', (_label, component, code) => {
    const s = scenario();

    TestBed.createComponent(component);
    s.tick();
    s.flush();

    takeRuntimeError(s, code);
  });
});
