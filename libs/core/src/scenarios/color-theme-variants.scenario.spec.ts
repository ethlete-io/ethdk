import { Component, DebugElement, inject, signal, TemplateRef, viewChild, ViewContainerRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ColorTheme,
  injectSemanticColorTheme,
  ProvideColorDirective,
  provideColorThemesWithTailwind4,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  SurfaceType,
  ThemeSwatch,
} from '../index';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const surface = (name: string, type: SurfaceType, fields: Partial<SurfaceTheme> = {}): SurfaceTheme => ({
  name,
  type,
  elevation: 0,
  background: type === 'light' ? '255 255 255' : '20 20 20',
  color: type === 'light' ? '0 0 0' : '255 255 255',
  colorMuted: '120 120 120',
  colorSubtle: '140 140 140',
  border: '160 160 160',
  ...fields,
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch('96 165 250') },
  { name: 'brandOnLight', primary: swatch('29 78 216') },
  { name: 'grey', primary: swatch('200 200 200') },
  { name: 'greyLight', primary: swatch('90 90 90') },
  { name: 'done', type: 'success', primary: swatch('74 222 128') },
  { name: 'doneOnLight', primary: swatch('22 101 52') },
];

const SURFACE_THEMES = [
  surface('night', 'dark', { isDefault: true }),
  surface('paper', 'light', {
    colorThemeVariants: { brand: 'brandOnLight', grey: 'greyLight', done: 'doneOnLight' },
  }),
  surface('legacy', 'light', { colorTheme: 'brandOnLight', semanticColorThemes: { success: 'doneOnLight' } }),
];

@Component({
  selector: 'et-scenario-variant-reader',
  template: '',
})
class VariantReaderComponent {
  success = injectSemanticColorTheme('success');
}

@Component({
  selector: 'et-scenario-color-theme-variants',
  imports: [ProvideSurfaceDirective, ProvideColorDirective, VariantReaderComponent],
  template: `
    <section etProvideSurface>
      <section class="paper" etProvideSurface="paper">
        <div class="grey-on-paper" etProvideColor="grey"></div>
        <section class="night-in-paper" etProvideSurface="night"></section>
        <et-scenario-variant-reader class="reader-on-paper" />
      </section>
      <section class="night" etProvideSurface="night">
        <div class="grey-on-night" etProvideColor="grey"></div>
        <et-scenario-variant-reader class="reader-on-night" />
      </section>
      <div class="grey" etProvideColor="grey">
        <section class="paper-in-grey" etProvideSurface="paper">
          <section class="night-in-paper-in-grey" etProvideSurface="night"></section>
        </section>
      </div>
      <section class="paper-with-grey" etProvideSurface="paper" etProvideColor="grey"></section>
      <section class="legacy" etProvideSurface="legacy">
        <div class="grey-on-legacy" etProvideColor="grey"></div>
        <et-scenario-variant-reader class="reader-on-legacy" />
      </section>
      <section [etProvideSurface]="switchable()" class="switchable">
        <div class="grey-on-switchable" etProvideColor="grey"></div>
      </section>
    </section>
  `,
})
class ColorThemeVariantsComponent {
  switchable = signal('night');
}

@Component({
  selector: 'et-scenario-detached-pane',
  imports: [ProvideSurfaceDirective],
  template: `
    <section etProvideSurface>
      <section etProvideSurface="paper">
        <ng-template #pane><section class="pane" etProvideSurface="paper"></section></ng-template>
      </section>
    </section>
  `,
})
class DetachedPaneComponent {
  pane = viewChild.required<TemplateRef<unknown>>('pane');
  viewContainerRef = inject(ViewContainerRef);
}

const colorClasses = (element: Element) =>
  [...element.classList].filter((name) => name.startsWith('et-color--') && name !== 'et-color--inherited');

const classesOf = (fixture: ComponentFixture<unknown>, selector: string) => {
  const element = (fixture.nativeElement as HTMLElement).querySelector(selector);

  if (!element) throw new Error(`${selector} is not rendered`);

  return colorClasses(element);
};

const reader = (fixture: { debugElement: DebugElement }, selector: string) => {
  const element = fixture.debugElement.query((d) => d.nativeElement.matches?.(selector));

  if (!element) throw new Error(`${selector} is not rendered`);

  return element.componentInstance as VariantReaderComponent;
};

describe('color theme variant scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemesWithTailwind4(COLOR_THEMES), provideSurfaceThemesWithTailwind4(SURFACE_THEMES)],
  });

  it('swaps a named accent on a surface that has an entry for it, and only there', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ColorThemeVariantsComponent);
    s.tick();

    expect(classesOf(fixture, '.grey-on-paper')).toEqual(['et-color--grey-light']);
    expect(classesOf(fixture, '.grey-on-night')).toEqual(['et-color--grey']);
    expect(classesOf(fixture, '.grey')).toEqual(['et-color--grey']);
    expect(classesOf(fixture, '.paper-in-grey')).toEqual(['et-color--grey-light']);
    expect(classesOf(fixture, '.paper-with-grey')).toEqual(['et-color--grey-light']);
  });

  it('paints the chosen accent again on a dark surface inside a light one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ColorThemeVariantsComponent);
    s.tick();

    expect(classesOf(fixture, '.night-in-paper')).toEqual(['et-color--brand']);
    expect(classesOf(fixture, '.night-in-paper-in-grey')).toEqual(['et-color--grey']);
  });

  it('swaps the default accent where nothing provides a color', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ColorThemeVariantsComponent);
    s.tick();

    expect(classesOf(fixture, '.paper')).toEqual(['et-color--brand-on-light']);
    expect(classesOf(fixture, '.night')).toEqual([]);
  });

  it('swaps the theme of a semantic type through colorThemeVariants', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ColorThemeVariantsComponent);
    s.tick();

    expect(reader(fixture, '.reader-on-paper').success().name).toBe('doneOnLight');
    expect(reader(fixture, '.reader-on-night').success().name).toBe('done');
  });

  it('keeps the deprecated colorTheme and semanticColorThemes working', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ColorThemeVariantsComponent);
    s.tick();

    expect(classesOf(fixture, '.legacy')).toEqual(['et-color--brand-on-light']);
    expect(classesOf(fixture, '.grey-on-legacy')).toEqual(['et-color--grey']);
    expect(reader(fixture, '.reader-on-legacy').success().name).toBe('doneOnLight');
  });

  it('follows a surface that changes at runtime', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ColorThemeVariantsComponent);
    s.tick();

    expect(classesOf(fixture, '.grey-on-switchable')).toEqual(['et-color--grey']);

    fixture.componentInstance.switchable.set('paper');
    s.tick();

    expect(classesOf(fixture, '.grey-on-switchable')).toEqual(['et-color--grey-light']);
    expect(classesOf(fixture, '.switchable')).toEqual(['et-color--brand-on-light']);
  });

  it('paints the swap on a pane that sits outside its parent surface in the DOM', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(DetachedPaneComponent);
    s.tick();

    const view = fixture.componentInstance.viewContainerRef.createEmbeddedView(fixture.componentInstance.pane());
    const pane = view.rootNodes[0] as HTMLElement;
    document.body.append(pane);
    s.tick();

    expect(colorClasses(pane)).toEqual(['et-color--brand-on-light']);

    view.destroy();
    pane.remove();
  });
});
