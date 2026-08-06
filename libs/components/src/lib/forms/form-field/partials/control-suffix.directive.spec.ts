import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { InputDirective } from '../../input/headless';
import { FormFieldComponent } from '../form-field.component';
import { LabelDirective } from '../headless';
import { ControlSuffixDirective } from './control-suffix.directive';
import { FormFieldBarrierDirective } from './form-field-barrier.directive';
import { InputSuffixDirective } from './input-suffix.directive';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: {
        default: '0 0 0',
        disabled: '0 36 23',
      },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: {
        default: '255 0 0',
        hover: '255 76 76',
        focus: '255 76 76',
        active: '198 0 0',
        disabled: '128 32 32',
      },
      onColor: {
        default: '0 0 0',
        disabled: '48 0 0',
      },
    },
  },
] as const;

@Component({
  selector: 'et-test-control',
  template: `
    <input etInput />

    <ng-template etControlSuffix>
      <button class="own-affordance" type="button">×</button>
    </ng-template>
  `,
  imports: [ControlSuffixDirective, InputDirective],
})
class TestControlComponent {}

/** The phone input's shape: the control registers outside the barrier, the suffix template inside. */
@Component({
  selector: 'et-test-barriered-control',
  template: `
    <input etInput />

    <div etFormFieldBarrier>
      <ng-template etControlSuffix>
        <button class="own-affordance" type="button">×</button>
      </ng-template>
    </div>
  `,
  imports: [ControlSuffixDirective, FormFieldBarrierDirective, InputDirective],
})
class BarrieredControlComponent {}

@Component({
  template: `
    @if (inField()) {
      <et-form-field>
        <et-label>Field</et-label>
        <et-test-control />
        <span class="consumer-suffix" etInputSuffix>€</span>
      </et-form-field>
    } @else {
      <et-test-control />
    }
  `,
  imports: [FormFieldComponent, InputSuffixDirective, LabelDirective, TestControlComponent],
})
class TestHost {
  inField = signal(true);
}

@Component({
  template: `
    <et-form-field>
      <et-label>Field</et-label>
      <et-test-barriered-control />
    </et-form-field>
  `,
  imports: [BarrieredControlComponent, FormFieldComponent, LabelDirective],
})
class BarrieredHost {}

describe('ControlSuffixDirective', () => {
  let fixture: ComponentFixture<TestHost>;

  const affordance = () => fixture.nativeElement.querySelector('.own-affordance') as HTMLElement | null;
  const suffixAffix = () => fixture.nativeElement.querySelector('.et-form-field-suffix') as HTMLElement | null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideColorThemes([...TEST_COLOR_THEMES])],
    });
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it("renders the control-owned template into the field's suffix slot", () => {
    expect(suffixAffix()?.contains(affordance())).toBe(true);
    expect(fixture.nativeElement.querySelector('et-test-control .own-affordance')).toBeNull();
  });

  it("orders the control's own affordance before the consumer's suffix", () => {
    const children = Array.from(suffixAffix()?.children ?? []);

    expect(children.findIndex((el) => el.classList.contains('own-affordance'))).toBeLessThan(
      children.findIndex((el) => el.classList.contains('consumer-suffix')),
    );
  });

  it('renders in place when there is no field to hand it to', () => {
    fixture.componentInstance.inField.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('et-test-control .own-affordance')).not.toBeNull();
  });

  it('renders in place behind a form field barrier', () => {
    const barriered = TestBed.createComponent(BarrieredHost);
    barriered.detectChanges();

    expect(barriered.nativeElement.querySelector('[etFormFieldBarrier] .own-affordance')).not.toBeNull();
    expect(barriered.nativeElement.querySelector('.et-form-field-suffix .own-affordance')).toBeNull();
  });
});
