import { Component, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { setInputSignal } from '@ethlete/core';
import '../../../test-helpers';
import { TooltipContent, TooltipDirective } from './tooltip.directive';

@Component({
  template: `
    <button etTooltip type="button">Trigger</button>

    <ng-template #tooltipTemplate>
      <span class="tooltip-template-content">Template tooltip</span>
    </ng-template>
  `,
  imports: [TooltipDirective],
})
class TooltipDirectiveTestHost {
  tooltipTemplate = viewChild.required<TemplateRef<unknown>>('tooltipTemplate');
}

describe('TooltipDirective', () => {
  let fixture: ComponentFixture<TooltipDirectiveTestHost>;
  let button: HTMLButtonElement;
  let tooltipDirective: TooltipDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TooltipDirectiveTestHost],
    });

    fixture = TestBed.createComponent(TooltipDirectiveTestHost);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button');
    tooltipDirective = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
    setInputSignal(tooltipDirective.content, 'Tooltip body' satisfies TooltipContent);
    setInputSignal(tooltipDirective.showDelay, 0);
    fixture.detectChanges();
  });

  afterEach(() => {
    tooltipDirective.hide();
  });

  it('creates a hidden accessible description for string content', () => {
    const descriptionId = button.getAttribute('aria-describedby');

    expect(descriptionId).toContain('et-tooltip-description');
    expect(document.getElementById(descriptionId ?? '')?.textContent).toBe('Tooltip body');
  });

  it('switches aria-describedby to the live tooltip id while shown', () => {
    const fallbackDescriptionId = button.getAttribute('aria-describedby');

    tooltipDirective.show();
    fixture.detectChanges();

    expect(button.getAttribute('aria-describedby')).toBe(tooltipDirective.overlayRef()?.config.id ?? null);

    tooltipDirective.hide();
    fixture.detectChanges();

    expect(button.getAttribute('aria-describedby')).toBe(fallbackDescriptionId);
  });

  it('does not open when disabled', () => {
    setInputSignal(tooltipDirective.disabled, true);
    fixture.detectChanges();

    tooltipDirective.show();

    expect(tooltipDirective.overlayRef()).toBeNull();
  });

  it('throws when template content is used without an aria description', () => {
    setInputSignal(tooltipDirective.content, fixture.componentInstance.tooltipTemplate());
    fixture.detectChanges();

    expect(() => tooltipDirective.show()).toThrow(/Template tooltips require etTooltipAriaDescription/);
  });
});
