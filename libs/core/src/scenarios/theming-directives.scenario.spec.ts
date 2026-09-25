import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AutoSurfaceDirective,
  ColorTheme,
  ColorThemeInput,
  injectSurfaceContextTracker,
  provideColorThemesWithTailwind4,
  ProvideColorDirective,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  ThemeSwatch,
} from '../index';
import { useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('200 20 20') },
  { name: 'darkAccent', primary: swatch('20 20 60') },
];

const surface = (name: string, elevation: number, isDefault = false): SurfaceTheme => ({
  name,
  type: 'light',
  elevation,
  isDefault,
  background: '255 255 255',
  color: '0 0 0',
  colorMuted: '60 60 60',
  colorSubtle: '120 120 120',
  border: '200 200 200',
});

const SURFACE_THEMES: SurfaceTheme[] = [surface('page', 0, true), surface('card', 1), surface('popover', 2)];

@Component({
  selector: 'et-scenario-themed-shell',
  imports: [ProvideColorDirective],
  hostDirectives: [ProvideColorDirective],
  template: `
    <div [etProvideColor]="outer()" class="outer">
      <section #passive class="passive" etProvideColor>
        <button [etProvideColor]="action()" class="action" type="button">Act</button>
      </section>
    </div>
    <span class="static" etProvideColor="darkAccent"></span>
  `,
})
class ThemedShellComponent {
  outer = signal<ColorThemeInput | undefined>(undefined);
  action = signal<ColorThemeInput | undefined>('alert');
  passive = viewChild.required('passive', { read: ProvideColorDirective });
}

@Component({
  selector: 'et-scenario-surfaces',
  imports: [ProvideSurfaceDirective, AutoSurfaceDirective],
  template: `
    <div class="page-level" etAutoSurface>
      <div class="nested" etAutoSurface>
        <div class="top" etAutoSurface></div>
      </div>
    </div>
    <section class="explicit" etProvideSurface="card">
      <div class="on-card" etAutoSurface></div>
    </section>
    <div class="pane-content" etAutoSurface></div>
    <div class="pane-panel" etAutoSurface></div>
  `,
})
class SurfacesComponent {
  autoSurfaces = viewChild.required(AutoSurfaceDirective);
}

const classOf = (host: HTMLElement, selector: string) => {
  const element = host.querySelector(selector) ?? (host.matches(selector) ? host : null);

  if (!element) throw new Error(`${selector} is not rendered`);

  return element.className;
};

describe('theming directive scenarios', () => {
  const scenario = useScenario({
    providers: [provideColorThemesWithTailwind4(COLOR_THEMES), provideSurfaceThemesWithTailwind4(SURFACE_THEMES)],
  });

  it('scopes a named, bound or passive color and resolves the inherited one through passive providers', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ThemedShellComponent);
    const host = fixture.nativeElement as HTMLElement;
    s.tick();

    expect(host.className).toContain('et-color--inherited');
    expect(classOf(host, '.passive')).toBe('passive et-color--inherited');
    expect(classOf(host, '.action')).toBe('action et-color--alert');
    expect(classOf(host, '.static')).toBe('static et-color--dark-accent');

    fixture.componentInstance.action.set(COLOR_THEMES[0] ?? null);
    s.tick();

    expect(classOf(host, '.action')).toBe('action et-color--brand');

    fixture.componentInstance.action.set(undefined);
    s.tick();

    expect(classOf(host, '.action')).toBe('action et-color--inherited');

    const passive = fixture.componentInstance.passive();

    expect(passive.resolvedColor()).toBeUndefined();

    fixture.componentInstance.outer.set('darkAccent');
    s.tick();

    expect(classOf(host, '.outer')).toBe('outer et-color--dark-accent');
    expect(classOf(host, '.passive')).toBe('passive et-color--inherited');
    expect(passive.resolvedColor()).toBe('darkAccent');

    fixture.componentInstance.action.set('surface');
    s.tick();

    expect(classOf(host, '.action')).toBe('action et-color--surface');

    fixture.destroy();
  });

  it('keeps detached content in sync with a provider and lets it go again', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ThemedShellComponent);
    const detached = TestBed.createComponent(ThemedShellComponent);
    const source = fixture.componentInstance.passive();
    const pane = detached.debugElement.injector.get(ProvideColorDirective);

    s.tick();
    pane.syncWithProvider(source);
    s.tick();

    expect(pane.effectiveColor()).toBeUndefined();

    fixture.componentInstance.outer.set('brand');
    s.tick();

    expect(pane.effectiveColor()).toBe('brand');
    expect((detached.nativeElement as HTMLElement).className).toContain('et-color--brand');

    pane.stopSyncWithProvider();
    s.tick();

    expect(pane.effectiveColor()).toBeUndefined();

    fixture.destroy();
    detached.destroy();
  });

  it('reports a color theme the app never registered', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ThemedShellComponent);

    fixture.componentInstance.action.set('missing' as ColorThemeInput);
    s.tick();

    s.expectError(/Theme missing does not exist/);
    expect(classOf(fixture.nativeElement as HTMLElement, '.action')).toBe('action et-color--missing');

    fixture.destroy();
  });

  it('raises each auto surface one elevation above the surface it sits on, and stops at the top', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfacesComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(classOf(host, '.page-level')).toBe('page-level et-surface--card');
    expect(classOf(host, '.nested')).toBe('nested et-surface--popover');
    expect(classOf(host, '.top')).toBe('top et-surface--inherited');
    expect(classOf(host, '.on-card')).toBe('on-card et-surface--popover');
    expect(fixture.componentInstance.autoSurfaces().resolvedSurface()).toBe('card');

    fixture.destroy();
  });

  it('follows content moved into an overlay pane, and paints the pane elevation for the pane panel', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfacesComponent);
    const host = fixture.nativeElement as HTMLElement;
    const tracker = s.run(() => injectSurfaceContextTracker());
    const pane = document.createElement('div');
    const content = host.querySelector<HTMLElement>('.pane-content');
    const panel = host.querySelector<HTMLElement>('.pane-panel');

    if (!content || !panel) throw new Error('pane fixtures are not rendered');

    const panelDirective = fixture.debugElement.children
      .find((child) => child.nativeElement === panel)
      ?.injector.get(AutoSurfaceDirective);

    s.tick();
    document.body.appendChild(pane);
    const unregister = tracker.register('light', 1, pane);

    panelDirective?.matchOverlaySurface();
    pane.append(content, panel);
    s.tick();
    s.tick();

    expect(content.className).toBe('pane-content et-surface--popover');
    expect(panel.className).toBe('pane-panel et-surface--card');

    unregister();
    host.append(content, panel);
    s.tick();
    s.tick();

    expect(content.className).toBe('pane-content et-surface--card');

    pane.remove();
    fixture.destroy();
  });
});
