import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { InputDirective } from '../input/headless';
import { FormFieldComponent } from './form-field.component';
import { LabelDirective } from './headless';
import { FormFieldLabelMode, FormFieldLabelPosition } from './form-field.variants';

@Component({
  template: `
    <et-form-field [labelPosition]="position()" [labelMode]="mode()">
      <et-label>Name</et-label>
      <input etInput />
    </et-form-field>
  `,
  imports: [FormFieldComponent, InputDirective, LabelDirective],
})
class Host {
  position = signal<FormFieldLabelPosition>('top');
  mode = signal<FormFieldLabelMode>('static');
}

const mount = () => {
  TestBed.configureTestingModule({ imports: [Host] });
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, host: fixture.componentInstance, field: el.querySelector('et-form-field') as HTMLElement };
};

describe('form-field labelPosition', () => {
  it('keeps the label inside the control frame by default', () => {
    const { field } = mount();

    expect(field.hasAttribute('data-label-position')).toBe(false);
    expect(field.querySelector('.et-form-field-control-frame et-label')).not.toBeNull();
  });

  it('renders the label before the control frame and outside it for start', async () => {
    const { fixture, host, field } = mount();
    host.position.set('start');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(field.getAttribute('data-label-position')).toBe('start');
    expect(field.querySelector('.et-form-field-control-frame et-label')).toBeNull();
    expect(field.querySelector('.et-form-field-shell > .et-form-field-label-area--start et-label')).not.toBeNull();
    expect(field.querySelectorAll('et-label').length).toBe(1);
  });

  it.each(['inline', 'floating-inside', 'floating-outside'] as const)('forces a static label for %s', (mode) => {
    const { fixture, host, field } = mount();
    host.mode.set(mode);
    host.position.set('start');
    fixture.detectChanges();

    expect(field.getAttribute('data-label-mode')).toBe('start');
    expect(field.querySelector('.et-form-field-label-area--floating, .et-form-field-label-area--inline')).toBeNull();
  });
});
