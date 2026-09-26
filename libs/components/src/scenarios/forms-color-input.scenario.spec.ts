import { Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField, required } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import {
  COLOR_INPUT_LABELS,
  COLOR_NOTATIONS,
  COLOR_NOTATION_ORDER,
  ColorInputComponent,
  colorContrast,
  DEFAULT_COLOR_INPUT_LABELS,
  FORM_FIELD_IMPORTS,
  getColorContrastRatio,
  hexColor,
  provideOverlay,
  rgbColor,
  WCAG_CONTRAST_RATIOS,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const UNSTYLED_BLOCKS = 'et-scrollbar { display: block; }';

@Component({
  selector: 'et-scenario-theme-form',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, ColorInputComponent, FormField],
  template: `
    <et-form-field class="text-field">
      <et-label>Text color</et-label>
      <et-color-input [formField]="theme.text" [swatches]="presets" (touch)="touches = touches + 1" />
    </et-form-field>
    <et-form-field class="accent-field">
      <et-label>Accent</et-label>
      <et-color-input [formField]="theme.accent" />
    </et-form-field>
    <p class="ratio">{{ ratio() }}</p>
  `,
})
class ThemeFormComponent {
  presets = ['#1d4ed8', 'rgb(220 38 38)', 'not-a-color', '#1D4ED8'];
  model = signal<{ text: string | null; background: string; accent: string | null }>({
    text: '#777777',
    background: '#ffffff',
    accent: null,
  });
  theme = form(this.model, (path) => {
    required(path.text, { message: 'Pick a text color' });
    hexColor(path.text);
    colorContrast(path.text, { against: path.background, min: WCAG_CONTRAST_RATIOS.aaNormal });
    colorContrast(path.accent, { against: '#ffffff', min: WCAG_CONTRAST_RATIOS.nonText, severity: 'warning' });
  });
  ratio = computed(() => getColorContrastRatio(this.model().text, this.model().background)?.toFixed(2) ?? 'n/a');
  touches = 0;
}

@Component({
  selector: 'et-scenario-overlay-tint',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [ColorInputComponent, ReactiveFormsModule],
  template: ` <et-color-input [formControl]="control" [notations]="notations()" aria-label="Overlay tint" alpha /> `,
})
class OverlayTintComponent {
  control = new FormControl<string | null>('#336699ff');
  notations = signal<readonly ('hex' | 'rgb' | 'hsl')[]>([COLOR_NOTATIONS.HSL]);
}

@Component({
  selector: 'et-scenario-strict-colors',
  imports: [],
  template: '',
})
class StrictColorsComponent {
  model = signal({ badge: '#f00', tint: 'rgba(0 0 0 / 0.5)', swatch: 'rgb(300 0 0)', loose: '#f00c' });
  colors = form(this.model, (path) => {
    hexColor(path.badge);
    rgbColor(path.tint);
    rgbColor(path.swatch, { allowAlpha: true, message: 'Use a valid rgb color' });
    hexColor(path.loose, { allowShorthand: true, allowAlpha: true });
  });
}

@Component({
  selector: 'et-scenario-token-labels',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [ColorInputComponent],
  providers: [{ provide: COLOR_INPUT_LABELS, useValue: (locale: string) => ({ dialog: `Farbe (${locale})` }) }],
  template: '<et-color-input [(value)]="color" />',
})
class TokenLabelsComponent {
  color = signal<string | null>(null);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
  s.flush();
};

const panel = () => query('et-color-picker-panel');

const entryField = () => query<HTMLInputElement>('et-color-picker-panel input:not([type="range"])');

const channel = (name: string) => query<HTMLInputElement>(`input[etColorPickerChannel="${name}"]`);

const enter = (s: Scenario, value: string) => {
  const input = entryField();

  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
  s.keydown('Enter', input);
  s.tick();
};

const slide = (s: Scenario, input: HTMLInputElement, value: number) => {
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  s.tick();
};

describe('forms color input scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlay(), provideColorThemes(TEST_COLOR_THEMES)] });

  it('picks colors into a signal form through the panel and validates hex and contrast', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ThemeFormComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    settle(s);

    const field = query('.text-field', host);
    const trigger = query<HTMLButtonElement>('.et-color-input-trigger', field);

    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-required')).toBe('true');
    expect(trigger.getAttribute('aria-labelledby')).toBe(query('et-label', field).id);
    expect(trigger.hasAttribute('aria-label')).toBe(false);
    expect(text(query('.et-color-input-value', field))).toBe('#777777');
    expect(text(query('.ratio', host))).toBe('4.48');
    expect(
      app.theme
        .text()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Contrast is 4.47:1, needs at least 4.5:1']);

    trigger.focus();
    trigger.blur();
    s.tick();
    expect(app.touches).toBe(1);
    expect(trigger.getAttribute('aria-invalid')).toBe('true');

    trigger.click();
    settle(s);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(panel().getAttribute('role')).toBe('dialog');
    expect(panel().getAttribute('aria-label')).toBe(DEFAULT_COLOR_INPUT_LABELS.dialog);
    expect(entryField().value).toBe('#777777');
    expect(entryField().getAttribute('aria-label')).toBe(
      `${DEFAULT_COLOR_INPUT_LABELS.value}, ${DEFAULT_COLOR_INPUT_LABELS.hex}`,
    );
    expect(queryAll('.et-color-picker-swatch').map((swatch) => swatch.getAttribute('aria-label'))).toEqual([
      '#1d4ed8',
      '#dc2626',
    ]);
    expect(channel('hue').getAttribute('aria-valuetext')).toBe('0°');
    expect(channel('brightness').getAttribute('aria-valuetext')).toBe('47%');
    expect(query('[etColorPickerArea]').getAttribute('aria-label')).toBe(DEFAULT_COLOR_INPUT_LABELS.area);

    enter(s, 'rgb(0, 0, 0)');
    expect(app.model().text).toBe('#000000');
    expect(app.theme.text().valid()).toBe(true);
    expect(entryField().value).toBe('rgb(0 0 0)');
    expect(query('.et-color-picker-notation').getAttribute('aria-label')).toBe(
      DEFAULT_COLOR_INPUT_LABELS.notation(DEFAULT_COLOR_INPUT_LABELS.rgb),
    );

    query<HTMLButtonElement>('.et-color-picker-notation').click();
    s.tick();
    expect(text(query('.et-color-picker-notation'))).toBe(DEFAULT_COLOR_INPUT_LABELS.hsl);
    expect(entryField().value).toMatch(/^hsl\(/);

    queryAll<HTMLButtonElement>('.et-color-picker-swatch')[0]?.click();
    s.tick();
    expect(app.model().text).toBe('#1d4ed8');
    expect(queryAll('.et-color-picker-swatch')[0]?.getAttribute('aria-pressed')).toBe('true');

    slide(s, channel('hue'), 0);
    slide(s, channel('saturation'), 100);
    slide(s, channel('brightness'), 50);
    expect(app.model().text).toBe('#800000');
    expect(channel('saturation').getAttribute('aria-valuetext')).toBe('100%');

    enter(s, 'nonsense');
    expect(app.model().text).toBe('#800000');

    s.keydown('Escape', document.activeElement ?? document);
    settle(s);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(text(query('.et-color-input-value', field))).toBe('#800000');

    app.model.update((model) => ({ ...model, accent: '#dddddd' }));
    s.tick();
    expect(app.theme.accent().valid()).toBe(true);
    expect(app.theme.accent().errors()).toEqual([]);
    expect(text(query('.accent-field et-form-warning', host))).toBe('Contrast is 1.35:1, needs at least 3:1');

    app.model.update((model) => ({ ...model, text: 'red' }));
    s.tick();
    expect(
      app.theme
        .text()
        .errors()
        .map((error) => error.kind),
    ).toEqual(['hexColor']);
  });

  it('binds an alpha color to a reactive form control and converts entries into a pinned notation', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(OverlayTintComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;
    const control = app.control;

    settle(s);

    const trigger = query<HTMLButtonElement>('.et-color-input-trigger', host);

    expect(trigger.getAttribute('aria-label')).toBe('Overlay tint');

    trigger.click();
    settle(s);

    expect(entryField().value).toMatch(/^hsl\(/);
    expect(text(query('.et-color-picker-notation'))).toBe(DEFAULT_COLOR_INPUT_LABELS.hsl);
    expect(channel('alpha').getAttribute('aria-valuetext')).toBe('100%');

    slide(s, channel('alpha'), 50);
    expect(control.value).toBe('#33669980');

    enter(s, '#ff000080');
    expect(control.value).toBe('#ff000080');
    expect(text(query('et-color-picker-panel et-form-warning'))).toBe(
      DEFAULT_COLOR_INPUT_LABELS.notationConverted(DEFAULT_COLOR_INPUT_LABELS.hsl),
    );

    app.notations.set([...COLOR_NOTATION_ORDER]);
    s.tick();
    expect(query('button.et-color-picker-notation')).toBeTruthy();

    s.keydown('Escape', document.activeElement ?? document);
    settle(s);
    expect(control.touched).toBe(true);

    control.setValue('#00ff00ff');
    s.tick();
    expect(text(query('.et-color-input-value', host))).toBe('#00ff00ff');

    control.disable();
    s.tick();
    expect(trigger.disabled).toBe(true);
  });

  it('validates hex and rgb notations outside a control', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StrictColorsComponent);
    const colors = fixture.componentInstance.colors;

    s.tick();

    expect(
      colors
        .badge()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Enter a color as #rrggbb']);
    expect(
      colors
        .tint()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Enter a color as rgb(r g b)']);
    expect(
      colors
        .swatch()
        .errors()
        .map((error) => error.message),
    ).toEqual(['Use a valid rgb color']);
    expect(colors.loose().valid()).toBe(true);
    expect(getColorContrastRatio('#000000', '#ffffff')).toBe(21);
    expect(getColorContrastRatio('#000000', 'teal')).toBeNull();
  });

  it('reads a per-locale labels source provided on the COLOR_INPUT_LABELS token', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TokenLabelsComponent);
    const host = fixture.nativeElement as HTMLElement;

    settle(s);

    const trigger = query<HTMLButtonElement>('.et-color-input-trigger', host);

    expect(trigger.getAttribute('aria-label')).toBe(DEFAULT_COLOR_INPUT_LABELS.pickerTrigger);

    trigger.click();
    settle(s);
    expect(panel().getAttribute('aria-label')).toMatch(/^Farbe \(.+\)$/);

    fixture.destroy();
    settle(s);
    expect(s.warnings.map((entry) => String(entry.warning))).toEqual([]);
    expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
  });
});
