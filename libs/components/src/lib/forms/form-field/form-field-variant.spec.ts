import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { InputDirective } from '../input/headless';
import { FormFieldComponent } from './form-field.component';
import { FormFieldVariant } from './form-field.variants';
import { LabelDirective } from './headless';

@Component({
  template: `
    <et-form-field [variant]="variant()">
      <et-label>Name</et-label>
      <input etInput />
    </et-form-field>
  `,
  imports: [FormFieldComponent, InputDirective, LabelDirective],
})
class HostComponent {
  public variant = signal<FormFieldVariant | undefined>(undefined);
}

describe('et-form-field variant', () => {
  const render = (variant?: FormFieldVariant) => {
    const fixture = TestBed.createComponent(HostComponent);
    if (variant) fixture.componentInstance.variant.set(variant);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('et-form-field') as HTMLElement;
  };

  it('sets no data-variant by default', () => {
    expect(render().hasAttribute('data-variant')).toBe(false);
  });

  // A form field takes a ghost variant and shows it as data-variant.
  it('reflects ghost as data-variant', () => {
    expect(render('ghost').getAttribute('data-variant')).toBe('ghost');
  });

  it('sets no data-variant for the default variant', () => {
    expect(render('default').hasAttribute('data-variant')).toBe(false);
  });
});
