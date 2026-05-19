import { Component, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { setInputSignal } from '@ethlete/core';
import '../../../test-helpers';
import { ToggletipContent, ToggletipDirective } from './toggletip.directive';

@Component({
  template: `
    <button etToggletip type="button">Trigger</button>

    <ng-template #toggletipTemplate>
      <span class="toggletip-template-content">Template toggletip</span>
    </ng-template>
  `,
  imports: [ToggletipDirective],
})
class ToggletipDirectiveTestHost {
  toggletipTemplate = viewChild.required<TemplateRef<unknown>>('toggletipTemplate');
}

describe('ToggletipDirective', () => {
  let fixture: ComponentFixture<ToggletipDirectiveTestHost>;
  let button: HTMLButtonElement;
  let toggletipDirective: ToggletipDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ToggletipDirectiveTestHost],
    });

    fixture = TestBed.createComponent(ToggletipDirectiveTestHost);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button');
    toggletipDirective = fixture.debugElement.query(By.directive(ToggletipDirective)).injector.get(ToggletipDirective);
    setInputSignal(toggletipDirective.content, 'More information' satisfies ToggletipContent);
    fixture.detectChanges();
  });

  afterEach(() => {
    toggletipDirective.hide();
    fixture.detectChanges();
  });

  it('exposes dialog trigger semantics while closed', () => {
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('data-toggletip-open')).toBeNull();
    expect(button.getAttribute('aria-controls')).toBeNull();
  });

  it('opens with the string content as the accessible label', () => {
    toggletipDirective.show();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('data-toggletip-open')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(toggletipDirective.overlayRef()?.config.id ?? null);
    expect(toggletipDirective.overlayRef()?.config.ariaLabel).toBe('More information');
  });

  it('clears its open state when disabled after opening', () => {
    toggletipDirective.show();
    fixture.detectChanges();

    setInputSignal(toggletipDirective.disabled, true);
    fixture.detectChanges();

    expect(toggletipDirective.open()).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBeNull();
    expect(button.getAttribute('aria-haspopup')).toBeNull();
  });

  it('throws when template content is used without an accessible label', () => {
    setInputSignal(toggletipDirective.content, fixture.componentInstance.toggletipTemplate());
    fixture.detectChanges();

    expect(() => {
      toggletipDirective.show();
      fixture.detectChanges();
    }).toThrow(/Template toggletips require etToggletipAriaLabel or etToggletipAriaLabelledBy/);
  });
});
