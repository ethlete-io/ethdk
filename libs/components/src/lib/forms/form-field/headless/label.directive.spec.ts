import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { InputDirective } from '../../input/headless';
import { FormFieldDirective } from './form-field.directive';
import { LabelDirective } from './label.directive';

@Component({
  template: `
    <div etFormField>
      <et-label>Test</et-label>
      <input etInput />
    </div>
  `,
  imports: [FormFieldDirective, InputDirective, LabelDirective],
})
class LabelTestHost {}

@Component({
  template: `
    <div etFormField>
      <et-label>Required</et-label>
      <input [required]="true" etInput />
    </div>
  `,
  imports: [FormFieldDirective, InputDirective, LabelDirective],
})
class RequiredLabelTestHost {}

@Component({
  template: `
    <div etFormField>
      <et-label>Optional</et-label>
      <input etInput />
    </div>
  `,
  imports: [FormFieldDirective, InputDirective, LabelDirective],
})
class OptionalLabelTestHost {}

@Component({
  template: `<et-label>Standalone</et-label>`,
  imports: [LabelDirective],
})
class StandaloneLabelTestHost {}

describe('LabelDirective', () => {
  describe('inside form field', () => {
    let fixture: ComponentFixture<LabelTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [LabelTestHost] });
      fixture = TestBed.createComponent(LabelTestHost);
      fixture.detectChanges();
    });

    it('should generate a unique id', () => {
      const labelEl = fixture.nativeElement.querySelector('et-label');
      expect(labelEl.id).toMatch(/^et-label-\d+$/);
    });

    it('should register with parent form field', () => {
      const formFieldDir = fixture.debugElement.children[0]!.injector.get(FormFieldDirective);
      expect(formFieldDir.registeredLabel()).toBeTruthy();
    });
  });

  describe('required marker', () => {
    it('renders a required marker when the control is required', () => {
      TestBed.configureTestingModule({ imports: [RequiredLabelTestHost] });

      const fixture = TestBed.createComponent(RequiredLabelTestHost);
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector('.et-label-required-marker');

      expect(marker?.textContent?.trim()).toBe('*');
    });

    it('does not render a required marker when the control is optional', () => {
      TestBed.configureTestingModule({ imports: [OptionalLabelTestHost] });

      const fixture = TestBed.createComponent(OptionalLabelTestHost);
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector('.et-label-required-marker');

      expect(marker).toBeNull();
    });
  });

  describe('standalone', () => {
    let fixture: ComponentFixture<StandaloneLabelTestHost>;

    beforeEach(() => {
      TestBed.configureTestingModule({ imports: [StandaloneLabelTestHost] });
      fixture = TestBed.createComponent(StandaloneLabelTestHost);
      fixture.detectChanges();
    });

    it('should create without a parent form field', () => {
      const labelEl = fixture.nativeElement.querySelector('et-label');
      expect(labelEl).toBeTruthy();
      expect(labelEl.id).toMatch(/^et-label-\d+$/);
    });
  });
});
