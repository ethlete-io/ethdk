import { Component, signal } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import '../../../../test-helpers';
import { mountControl } from '../../../testing/control-driver';
import { FORM_FIELD_IMPORTS } from '../../form-field/form-field.imports';
import { expectDescribedByPointsAtErrors } from '../../testing/described-by';
import { mountSwitch, SwitchDriver } from '../../testing/switch-driver';
import { SWITCH_IMPORTS } from '../switch.imports';
import { SwitchDirective } from './switch.directive';

@Component({
  template: `<div etSwitch></div>`,
  imports: [SwitchDirective],
})
class StandaloneSwitchTestHost {}

@Component({
  template: `<div [indeterminate]="indeterminate()" etSwitch></div>`,
  imports: [SwitchDirective],
})
class IndeterminateSwitchTestHost {
  indeterminate = signal(true);
}

@Component({
  template: `
    <et-form-field>
      <et-label>Notifications</et-label>
      <et-switch [(touched)]="touched" [errors]="errors" invalid name="notifications" />
      <et-hint>Sends a daily digest</et-hint>
    </et-form-field>
  `,
  imports: [FORM_FIELD_IMPORTS, SWITCH_IMPORTS],
})
class SwitchInFormFieldTestHost {
  errors = [{ kind: 'required', message: 'Turn notifications on' }];

  touched = signal(true);
}

@Component({
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -- et-switch is the control -->
    <label id="wrapping-label">Wrapped <et-switch id="wrapped" /></label>
    <label for="linked">Linked</label>
    <et-switch id="linked" />
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -- et-switch is the control -->
    <label>Named <et-switch id="input-named" aria-label="From input" /></label>
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -- et-switch is the control -->
    <label>Static <et-switch id="static-label" aria-label="Static name" /></label>
    <et-switch [attr.aria-label]="boundName" id="bound-label" />
    <et-switch [attr.aria-labelledby]="'external-name'" id="bound-labelledby" />
    <et-switch id="static-labelledby" aria-labelledby="external-name" />
    <label id="input-label"><input type="checkbox" /> Other <et-switch id="beside-input" /></label>
    <span id="external-name">External</span>
  `,
  imports: [SWITCH_IMPORTS],
})
class SwitchNamingTestHost {
  boundName = 'Bound name';
}

describe('SwitchDirective', () => {
  describe('accessible name', () => {
    let fixture: ComponentFixture<SwitchNamingTestHost>;
    let host: HTMLElement;
    const switchEl = (id: string) => host.querySelector<HTMLElement>(`#${id}`)!;
    const checked = (id: string) => {
      fixture.detectChanges();

      return switchEl(id).getAttribute('aria-checked');
    };

    beforeEach(() => {
      fixture = mountControl(SwitchNamingTestHost);
      host = fixture.nativeElement as HTMLElement;
    });

    it('is named by a wrapping native label', () => {
      expect(switchEl('wrapped').getAttribute('aria-labelledby')).toBe('wrapping-label');
    });

    it('toggles once from a click on the wrapping label or on itself', () => {
      host.querySelector<HTMLElement>('#wrapping-label')!.click();
      expect(checked('wrapped')).toBe('true');

      switchEl('wrapped').click();
      expect(checked('wrapped')).toBe('false');
    });

    it('is named by a label pointing at its id, which gets an id of its own', () => {
      const label = host.querySelector<HTMLLabelElement>('label[for="linked"]')!;

      expect(label.id).toBeTruthy();
      expect(switchEl('linked').getAttribute('aria-labelledby')).toBe(label.id);

      label.click();
      expect(checked('linked')).toBe('true');
    });

    it('lets its aria-label input win over a native label', () => {
      expect(switchEl('input-named').getAttribute('aria-label')).toBe('From input');
      expect(switchEl('input-named').getAttribute('aria-labelledby')).toBeNull();
      expect(switchEl('static-label').getAttribute('aria-label')).toBe('Static name');
    });

    it('keeps an aria-label or aria-labelledby bound on the host', () => {
      expect(switchEl('bound-label').getAttribute('aria-label')).toBe('Bound name');
      expect(switchEl('bound-labelledby').getAttribute('aria-labelledby')).toBe('external-name');
      expect(switchEl('static-labelledby').getAttribute('aria-labelledby')).toBe('external-name');
    });

    it('leaves a label that already names a native input alone', () => {
      host.querySelector<HTMLElement>('#input-label')!.click();

      expect(switchEl('beside-input').getAttribute('aria-labelledby')).toBeNull();
      expect(checked('beside-input')).toBe('false');
    });
  });

  describe('standalone', () => {
    let driver: SwitchDriver<StandaloneSwitchTestHost>;

    beforeEach(() => {
      driver = mountSwitch(StandaloneSwitchTestHost);
    });

    it('should have role switch', () => {
      expect(driver.attr('role')).toBe('switch');
    });

    it('should have aria-checked false by default', () => {
      expect(driver.attr('aria-checked')).toBe('false');
    });

    it('should toggle checked on click', () => {
      driver.toggle();

      expect(driver.switch.checked()).toBe(true);
      expect(driver.attr('aria-checked')).toBe('true');
    });

    it('focuses without a focus ring when activated through its label, like the checkbox', () => {
      const el = driver.fixture.nativeElement.querySelector('[etSwitch]') as HTMLElement;
      const focus = vi.spyOn(el, 'focus');

      driver.switch.activate();

      expect(driver.switch.checked()).toBe(true);
      expect(focus).toHaveBeenCalledWith({ focusVisible: false });
    });

    it('toggles once for a held Space, ignoring the auto-repeat', () => {
      const el = driver.fixture.nativeElement.querySelector('[etSwitch]') as HTMLElement;

      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, repeat: true }));

      expect(driver.switch.checked()).toBe(true);
    });
  });

  describe('indeterminate', () => {
    let driver: SwitchDriver<IndeterminateSwitchTestHost>;

    beforeEach(() => {
      driver = mountSwitch(IndeterminateSwitchTestHost);
    });

    it('should reflect data-indeterminate while indeterminate but keep aria-checked boolean', () => {
      // role=switch does not support aria-checked="mixed" - it stays boolean
      expect(driver.attr('aria-checked')).toBe('false');
      expect(driver.attr('data-indeterminate')).toBe('true');
    });

    it('should resolve to checked on the first toggle', () => {
      driver.toggle();

      expect(driver.switch.indeterminate()).toBe(false);
      expect(driver.switch.checked()).toBe(true);
      expect(driver.attr('data-indeterminate')).toBeNull();
      expect(driver.attr('aria-checked')).toBe('true');
    });
  });

  describe('in a form field', () => {
    it('should describe the switch by the rendered error', () => {
      const host = mountControl(SwitchInFormFieldTestHost).nativeElement as HTMLElement;

      expectDescribedByPointsAtErrors(host);
    });
  });
});
