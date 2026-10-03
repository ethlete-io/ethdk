import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccordionComponent } from './accordion.component';

@Component({
  template: `<et-accordion [(isOpen)]="isOpen" [isOpenByDefault]="isOpenByDefault()" label="Label" />`,
  imports: [AccordionComponent],
})
class AccordionHostComponent {
  isOpen = signal(true);
  isOpenByDefault = signal(false);
}

describe('AccordionComponent', () => {
  it('keeps a bound isOpen when isOpenByDefault is false', () => {
    const fixture = TestBed.createComponent(AccordionHostComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.et-accordion-header').getAttribute('aria-expanded')).toBe('true');
  });

  it('opens when isOpenByDefault is true', () => {
    const fixture = TestBed.createComponent(AccordionHostComponent);
    fixture.componentInstance.isOpen.set(false);
    fixture.componentInstance.isOpenByDefault.set(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(true);
  });
});
