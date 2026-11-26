import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideColorThemes,
  provideSurfaceThemesWithTailwind4,
  ProvideSurfaceDirective,
  SurfaceTheme,
} from '@ethlete/core';
import '../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../testing/color-themes';
import { InputDirective } from '../input/headless';
import { FormFieldComponent } from './form-field.component';
import { FormFieldFill } from './form-field.variants';
import { LabelDirective } from './headless';

const surface = (name: string, elevation: number, isDefault?: boolean): SurfaceTheme => ({
  name,
  type: 'dark',
  elevation,
  isDefault,
  background: '0 0 0',
  color: '255 255 255',
  colorMuted: '180 180 180',
  colorSubtle: '80 80 80',
  border: '40 40 40',
});

@Component({
  template: `
    <div etProvideSurface="dark">
      <et-form-field [fill]="fill()">
        <et-label>Name</et-label>
        <input etInput />
      </et-form-field>
    </div>
  `,
  imports: [FormFieldComponent, InputDirective, LabelDirective, ProvideSurfaceDirective],
})
class HostComponent {
  public fill = signal<FormFieldFill>('transparent');
}

const render = (fill: FormFieldFill, themes: SurfaceTheme[]) => {
  TestBed.configureTestingModule({
    providers: [provideSurfaceThemesWithTailwind4(themes), provideColorThemes(TEST_COLOR_THEMES)],
  });

  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.fill.set(fill);
  fixture.detectChanges();

  return fixture.nativeElement.querySelector('et-form-field') as HTMLElement;
};

const THEMES = [surface('dark-sunken', -1), surface('dark', 0, true), surface('dark-elevated', 1)];

describe('FormFieldComponent fill surface', () => {
  it('paints a sunken field one elevation below its parent surface', () => {
    const field = render('sunken', THEMES);

    expect(field.getAttribute('data-fill')).toBe('sunken');
    expect(field.classList.contains('et-surface--dark-sunken')).toBe(true);
    expect(field.hasAttribute('data-et-surface-fill')).toBe(false);
  });

  it('keeps raising a filled field one elevation above its parent surface', () => {
    const field = render('filled', THEMES);

    expect(field.classList.contains('et-surface--dark-elevated')).toBe(true);
    expect(field.hasAttribute('data-et-surface-fill')).toBe(true);
  });

  it('inherits the parent surface when no theme sits one elevation below', () => {
    const field = render('sunken', [surface('dark', 0, true), surface('dark-elevated', 1)]);

    expect(field.classList.contains('et-surface--dark-sunken')).toBe(false);
    expect(field.classList.contains('et-surface--dark-elevated')).toBe(false);
  });
});
