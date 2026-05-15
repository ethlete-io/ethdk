import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../../test-helpers';
import { ButtonComponent } from '../../button/button.component';
import { ToggletipTriggerDirective } from './toggletip-trigger.directive';
import { ToggletipDirective } from './toggletip.directive';

@Component({
  template: `
    <button [etToggletipOpen]="open" etToggletip="Info" et-button etToggletipTrigger type="button" variant="outline">
      Trigger
    </button>
  `,
  imports: [ButtonComponent, ToggletipDirective, ToggletipTriggerDirective],
})
class ToggletipTriggerDirectiveTestHost {
  open = false;
}

describe('ToggletipTriggerDirective', () => {
  let fixture: ComponentFixture<ToggletipTriggerDirectiveTestHost>;
  let button: HTMLButtonElement;
  let toggletipDirective: ToggletipDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ToggletipTriggerDirectiveTestHost] });
    fixture = TestBed.createComponent(ToggletipTriggerDirectiveTestHost);
    button = fixture.nativeElement.querySelector('button');
    toggletipDirective = fixture.debugElement.query(By.directive(ToggletipDirective)).injector.get(ToggletipDirective);
  });

  afterEach(() => {
    toggletipDirective.hide();
    fixture.detectChanges();
  });

  it('has no data-pressed state by default', () => {
    fixture.detectChanges();
    expect(button.getAttribute('data-pressed')).toBeNull();
    expect(button.getAttribute('data-pressed-variant')).toBeNull();
  });

  it('applies button pressed styling attrs when the toggletip is open', () => {
    fixture.componentInstance.open = true;
    fixture.detectChanges();

    expect(button.getAttribute('data-pressed')).toBe('true');
    expect(button.getAttribute('data-pressed-variant')).toBe('filled');
    expect(button.getAttribute('aria-pressed')).toBeNull();
  });
});
