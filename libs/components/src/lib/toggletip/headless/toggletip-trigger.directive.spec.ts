import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { setInputSignal } from '@ethlete/core';
import '../../../test-helpers';
import { ButtonComponent } from '../../button/button.component';
import { IconButtonComponent } from '../../button/icon-button.component';
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

@Component({
  template: `
    <button
      [etToggletipOpen]="open()"
      [variant]="variant()"
      aria-label="Info"
      etToggletip="Info"
      et-icon-button
      etToggletipTrigger
      type="button"
    >
      i
    </button>
  `,
  imports: [IconButtonComponent, ToggletipDirective, ToggletipTriggerDirective],
})
class ToggletipIconTriggerTestHost {
  open = signal(false);
  variant = signal<'filled' | 'tonal'>('filled');
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

  it('keeps a consumer-bound etToggletipDisabled instead of overwriting it', () => {
    fixture.detectChanges();

    setInputSignal(toggletipDirective.disabled, true);
    fixture.detectChanges();

    toggletipDirective.show();
    fixture.detectChanges();

    expect(toggletipDirective.open()).toBe(false);
    expect(toggletipDirective.overlayRef()).toBeNull();
  });

  it("follows the icon button's own pressed variant, also when the variant changes while open", () => {
    const iconFixture = TestBed.createComponent(ToggletipIconTriggerTestHost);
    const iconButton = iconFixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const iconToggletip = iconFixture.debugElement
      .query(By.directive(ToggletipDirective))
      .injector.get(ToggletipDirective);

    iconFixture.componentInstance.open.set(true);
    iconFixture.detectChanges();

    expect(iconButton.getAttribute('data-pressed-variant')).toBe('transparent');

    iconFixture.componentInstance.variant.set('tonal');
    iconFixture.detectChanges();

    expect(iconButton.getAttribute('data-pressed-variant')).toBe('filled');

    iconToggletip.hide();
    iconFixture.detectChanges();
  });
});
