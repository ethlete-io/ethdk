import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import {
  ColorTheme,
  provideColorThemesWithTailwind4,
  ProvideSurfaceDirective,
  provideSurfaceThemesWithTailwind4,
  SurfaceTheme,
  SurfaceType,
  ThemeSwatch,
} from '@ethlete/core';
import {
  FORM_FIELD_IMPORTS,
  INPUT_IMPORTS,
  MenuComponent,
  MenuDirective,
  MenuItemComponent,
  MenuSurfaceDirective,
  MenuTriggerDirective,
  provideOverlay,
  SelectComponent,
  SelectOptionComponent,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const swatch = (value: `${number} ${number} ${number}`): ThemeSwatch => ({
  color: { default: value, hover: value, active: value, disabled: value },
  onColor: { default: '255 255 255' },
});

const surface = (
  name: string,
  type: SurfaceType,
  elevation: number,
  semanticColorThemes?: SurfaceTheme['semanticColorThemes'],
): SurfaceTheme => ({
  name,
  type,
  elevation,
  isDefault: name === 'night',
  semanticColorThemes,
  background: type === 'light' ? '255 255 255' : '20 20 20',
  color: type === 'light' ? '0 0 0' : '255 255 255',
  colorMuted: '120 120 120',
  colorSubtle: '140 140 140',
  border: '160 160 160',
});

const COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch('0 90 200') },
  { name: 'alert', type: 'error', primary: swatch('248 113 113') },
  { name: 'alertOnPaper', primary: swatch('153 27 27') },
  { name: 'alertOnRaised', primary: swatch('127 29 29') },
];

const SURFACE_THEMES = [
  surface('night', 'dark', 0),
  surface('nightRaised', 'dark', 1),
  surface('paper', 'light', 0, { error: 'alertOnPaper' }),
  surface('paperRaised', 'light', 1, { error: 'alertOnRaised' }),
];

@Component({
  selector: 'et-scenario-surface-email',
  imports: [INPUT_IMPORTS, FORM_FIELD_IMPORTS, FormField, ProvideSurfaceDirective],
  template: `
    <section [etProvideSurface]="surface()">
      <et-form-field>
        <et-label>Email</et-label>
        <et-input [formField]="signup.email" />
      </et-form-field>
    </section>
  `,
})
class SurfaceEmailComponent {
  surface = signal('paper');
  model = signal({ email: '' });
  signup = form(this.model, (path) => required(path.email, { message: 'Email is required' }));
}

@Component({
  selector: 'et-scenario-surface-select',
  imports: [SelectComponent, SelectOptionComponent, ProvideSurfaceDirective],
  template: `
    <section [etProvideSurface]="surface()">
      <et-select [(value)]="coach" error="Coaches unavailable" aria-label="Coach">
        <et-select-option value="ana">Ana</et-select-option>
      </et-select>
    </section>
  `,
})
class SurfaceSelectComponent {
  surface = signal('paper');
  coach = signal<string | null>(null);
}

@Component({
  selector: 'et-scenario-surface-menu',
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuComponent,
    MenuItemComponent,
    ProvideSurfaceDirective,
  ],
  template: `
    <section [etProvideSurface]="surface()">
      <div etMenu>
        <button class="trigger" etMenuTrigger type="button">Team</button>
        <ng-template etMenuSurface>
          <et-menu>
            <button class="delete" et-menu-item variant="destructive" type="button">Delete</button>
          </et-menu>
        </ng-template>
      </div>
    </section>
  `,
})
class SurfaceMenuComponent {
  surface = signal('paper');
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const settle = (s: Scenario) => {
  s.tick();
  s.flush();
  s.frame(3);
  s.tick(400);
};

describe('semantic colors follow the surface', () => {
  const scenario = useScenario({
    providers: [
      provideOverlay(),
      provideColorThemesWithTailwind4(COLOR_THEMES),
      provideSurfaceThemesWithTailwind4(SURFACE_THEMES),
    ],
  });

  it("colours a form field's error by its surface, and falls back to the error theme where the surface maps none", () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceEmailComponent);
    const host = fixture.nativeElement as HTMLElement;
    settle(s);

    fixture.componentInstance.signup.email().markAsTouched();
    settle(s);

    expect(query('.et-form-field-errors', host).classList).toContain('et-color--alert-on-paper');
    expect(query('et-form-field', host).classList).toContain('et-color--alert-on-paper');

    fixture.componentInstance.surface.set('night');
    settle(s);

    expect(query('.et-form-field-errors', host).classList).toContain('et-color--alert');
    expect(query('et-form-field', host).classList).toContain('et-color--alert');
  });

  it('colours a select panel error by the surface the panel paints, not the one its trigger sits on', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceSelectComponent);
    settle(s);

    query('[role="combobox"]', fixture.nativeElement as HTMLElement).click();
    settle(s);

    expect(query('et-select-panel').classList).toContain('et-surface--paper-raised');
    expect(query('.et-select-state--error').classList).toContain('et-color--alert-on-raised');
  });

  it('falls back to the error theme in a select panel on a surface that maps none', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceSelectComponent);
    fixture.componentInstance.surface.set('night');
    settle(s);

    query('[role="combobox"]', fixture.nativeElement as HTMLElement).click();
    settle(s);

    expect(query('.et-select-state--error').classList).toContain('et-color--alert');
  });

  it('colours a destructive menu item by the surface of the menu panel', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SurfaceMenuComponent);
    settle(s);

    query('.trigger', fixture.nativeElement as HTMLElement).click();
    settle(s);

    expect(query('et-menu').classList).toContain('et-surface--paper-raised');
    expect(query('.delete').classList).toContain('et-color--alert-on-raised');

    s.keydown('Escape', document);
    settle(s);
    fixture.componentInstance.surface.set('night');
    settle(s);

    query('.trigger', fixture.nativeElement as HTMLElement).click();
    settle(s);

    expect(query('.delete').classList).toContain('et-color--alert');
  });
});
