import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { disabled, form, FormField } from '@angular/forms/signals';
import '../../../test-helpers';
import { SWITCH_IMPORTS } from '../switch/switch.imports';
import { RADIO_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS } from './selection-list.imports';

@Component({
  template: `
    <et-switch [formField]="f.on" />
    <et-radio-group [formField]="f.size">
      <et-radio value="a">A</et-radio>
      <et-radio value="b">B</et-radio>
    </et-radio-group>
    <et-segmented-button-group [formField]="f.view">
      <et-segmented-button value="day">Day</et-segmented-button>
      <et-segmented-button value="week">Week</et-segmented-button>
    </et-segmented-button-group>
  `,
  imports: [SWITCH_IMPORTS, RADIO_GROUP_IMPORTS, SEGMENTED_BUTTON_IMPORTS, FormField],
})
class BindingHost {
  public isLocked = signal(false);
  public model = signal({ on: true, size: 'b' as string | null, view: 'week' as string | null });
  public f = form(this.model, (s) => {
    disabled(s.on, () => this.isLocked());
    disabled(s.size, () => this.isLocked());
    disabled(s.view, () => this.isLocked());
  });
}

describe('[formField] binding on switch, radio group and segmented button group', () => {
  const mount = () => {
    const fixture = TestBed.createComponent(BindingHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      host: fixture.componentInstance,
      sw: el.querySelector('et-switch') as HTMLElement,
      radios: Array.from(el.querySelectorAll('et-radio')) as HTMLElement[],
      segs: Array.from(el.querySelectorAll('et-segmented-button')) as HTMLElement[],
      radioGroup: el.querySelector('et-radio-group') as HTMLElement,
      segGroup: el.querySelector('et-segmented-button-group') as HTMLElement,
    };
  };

  it('writes the form model into each control', () => {
    const m = mount();

    expect(m.sw.getAttribute('aria-checked')).toBe('true');
    expect(m.radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(m.segs.map((r) => r.getAttribute('aria-checked'))).toEqual(['false', 'true']);

    m.host.model.set({ on: false, size: 'a', view: 'day' });
    m.fixture.detectChanges();

    expect(m.sw.getAttribute('aria-checked')).toBe('false');
    expect(m.radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(m.segs.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('writes user interaction back into the form model', () => {
    const m = mount();

    m.sw.click();
    m.radios[0]!.click();
    m.segs[0]!.click();
    m.fixture.detectChanges();

    expect(m.host.model()).toEqual({ on: false, size: 'a', view: 'day' });
  });

  it('propagates a form-level disabled state', () => {
    const m = mount();

    m.host.isLocked.set(true);
    m.fixture.detectChanges();

    expect(m.sw.getAttribute('aria-disabled')).toBe('true');
    expect(m.radioGroup.getAttribute('data-disabled')).toBe('true');
    expect(m.segGroup.getAttribute('data-disabled')).toBe('true');

    m.sw.click();
    m.radios[0]!.click();
    m.segs[0]!.click();
    m.fixture.detectChanges();

    expect(m.host.model()).toEqual({ on: true, size: 'b', view: 'week' });
  });
});
