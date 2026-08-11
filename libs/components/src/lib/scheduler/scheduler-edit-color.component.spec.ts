import { Component, signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorPalette, provideColorThemesWithTailwind4 } from '@ethlete/core';
import '../../test-helpers';
import { SchedulerEditColorComponent } from './scheduler-edit-color.component';
import { Appointment } from './scheduler.types';

const appointment = (colorToken?: string): Appointment => ({
  id: 'a-1',
  parentId: null,
  title: 'Daily standup',
  start: new Date('2026-08-10T09:00:00'),
  end: new Date('2026-08-10T09:15:00'),
  colorToken,
});

@Component({
  selector: 'et-test-scheduler-edit-color-host',
  template: `<et-scheduler-edit-color [draft]="draft" />`,
  imports: [SchedulerEditColorComponent],
})
class EditColorHostComponent {
  public draft: WritableSignal<Appointment> = signal(appointment('brand'));
}

const swatch = (color: string) => ({
  color: { default: color, hover: color, active: color, disabled: color },
  onColor: { default: '0 0 0' },
});

// the form-field support layer resolves the error theme by type, so a spec rendering any control needs one
const TEST_COLOR_THEMES: ColorTheme[] = [
  { name: 'brand', isDefault: true, primary: swatch('0 255 161') },
  { name: 'success', primary: swatch('22 163 74') },
  { name: 'danger', type: 'error', primary: swatch('220 38 38') },
];

const PALETTE = [
  { token: 'brand', label: 'Team' },
  { token: 'success', label: 'Training' },
];

const createFixture = (palette?: typeof PALETTE) => {
  TestBed.configureTestingModule({
    providers: [provideColorThemesWithTailwind4(TEST_COLOR_THEMES), ...(palette ? [provideColorPalette(palette)] : [])],
  });

  const fixture = TestBed.createComponent(EditColorHostComponent);
  fixture.detectChanges();

  return fixture;
};

describe('SchedulerEditColorComponent', () => {
  it('falls back to a text field when no palette is provided', () => {
    const fixture = createFixture();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('et-radio')).toHaveLength(0);
    expect(host.querySelector<HTMLInputElement>('et-input input')?.value).toBe('brand');
  });

  it('renders one option per palette entry plus the "no color" choice, with the draft preselected', () => {
    const fixture = createFixture(PALETTE);
    const radios = [...(fixture.nativeElement as HTMLElement).querySelectorAll('et-radio')];

    expect(radios.map((radio) => radio.textContent?.trim())).toEqual(['No color', 'Team', 'Training']);
    expect(radios.map((radio) => radio.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false']);
  });

  it('writes the picked token into the draft', () => {
    const fixture = createFixture(PALETTE);
    const radios = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('et-radio')];

    radios[2]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.draft().colorToken).toBe('success');
  });

  it('clears the token back to undefined on the "no color" choice', () => {
    const fixture = createFixture(PALETTE);
    const radios = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('et-radio')];

    radios[0]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.draft().colorToken).toBeUndefined();
  });
});
