import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { AccordionGroupComponent } from './accordion-group.component';
import { AccordionComponent } from './accordion.component';
import { ACCORDION_IMPORTS } from './accordion.imports';
import { AccordionDirective, AccordionGroupDirective } from './headless';

@Component({
  selector: 'et-test-accordion-host',
  template: `
    <et-accordion-group [autoCloseOthers]="autoCloseOthers()">
      @for (section of sections(); track section) {
        <et-accordion [label]="section" [isOpenByDefault]="section === openByDefault()"
          >{{ section }} body</et-accordion
        >
      }
    </et-accordion-group>
  `,
  imports: [ACCORDION_IMPORTS],
})
class AccordionHostComponent {
  // read the headless directive off the group component's element — it is applied as a host directive
  public group = viewChild.required(AccordionGroupComponent, { read: AccordionGroupDirective });

  public sections = signal(['first', 'second', 'third']);
  public autoCloseOthers = signal(false);
  public openByDefault = signal<string | null>(null);
}

const createHost = (): ComponentFixture<AccordionHostComponent> => {
  const fixture = TestBed.createComponent(AccordionHostComponent);
  fixture.detectChanges();

  return fixture;
};

const openStates = (fixture: ComponentFixture<AccordionHostComponent>) =>
  fixture.componentInstance
    .group()
    .accordions()
    .map((accordion) => accordion.isOpen());

describe('AccordionComponent', () => {
  it('renders a heading-wrapped trigger and a labelled region, wired to each other', () => {
    const fixture = TestBed.createComponent(AccordionComponent);
    fixture.componentRef.setInput('label', 'Shipping');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const heading = host.querySelector('.et-accordion-heading');
    const trigger = host.querySelector('.et-accordion-trigger');
    const panel = host.querySelector('.et-accordion-panel');

    expect(heading?.getAttribute('role')).toBe('heading');
    expect(heading?.getAttribute('aria-level')).toBe('3');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(trigger?.getAttribute('aria-controls')).toBe(panel?.id);
    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.getAttribute('aria-labelledby')).toBe(trigger?.id);
    expect(panel?.hasAttribute('inert')).toBe(true);
  });

  it('toggles open on trigger click, and drops inert while open', () => {
    const fixture = TestBed.createComponent(AccordionComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const trigger = host.querySelector<HTMLButtonElement>('.et-accordion-trigger');

    trigger?.click();
    fixture.detectChanges();

    const panel = host.querySelector('.et-accordion-panel');

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(panel?.hasAttribute('inert')).toBe(false);
    expect(panel?.hasAttribute('data-open')).toBe(true);

    trigger?.click();
    fixture.detectChanges();

    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    expect(panel?.hasAttribute('inert')).toBe(true);
  });

  it('marks a disabled accordion aria-disabled and refuses to toggle', () => {
    const fixture = TestBed.createComponent(AccordionComponent);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.et-accordion-trigger');

    expect(trigger?.getAttribute('aria-disabled')).toBe('true');
    // focusable rather than natively disabled, so a screen reader can still reach the header
    expect(trigger?.hasAttribute('disabled')).toBe(false);

    trigger?.click();
    fixture.detectChanges();

    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
  });

  it('honors headingLevel', () => {
    const fixture = TestBed.createComponent(AccordionComponent);
    fixture.componentRef.setInput('headingLevel', 2);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.et-accordion-heading')?.getAttribute('aria-level'),
    ).toBe('2');
  });

  it('keeps hasBeenOpened true after a collapse, so deferred content stays mounted', () => {
    const fixture = TestBed.createComponent(AccordionComponent);
    fixture.detectChanges();

    const accordion = fixture.debugElement.injector.get(AccordionDirective);

    expect(accordion.hasBeenOpened()).toBe(false);

    accordion.open();
    fixture.detectChanges();
    expect(accordion.hasBeenOpened()).toBe(true);

    accordion.close();
    fixture.detectChanges();
    expect(accordion.hasBeenOpened()).toBe(true);
  });
});

describe('AccordionGroupComponent', () => {
  it('leaves several panels open by default', () => {
    const fixture = createHost();
    const [first, second] = fixture.componentInstance.group().accordions();

    first?.open();
    second?.open();
    fixture.detectChanges();

    expect(openStates(fixture)).toEqual([true, true, false]);
  });

  it('collapses the others when one opens under autoCloseOthers', () => {
    const fixture = createHost();
    fixture.componentInstance.autoCloseOthers.set(true);
    fixture.detectChanges();

    const [first, , third] = fixture.componentInstance.group().accordions();

    first?.open();
    fixture.detectChanges();
    expect(openStates(fixture)).toEqual([true, false, false]);

    third?.open();
    fixture.detectChanges();
    expect(openStates(fixture)).toEqual([false, false, true]);
  });

  it('keeps the first open one when autoCloseOthers turns on later', () => {
    const fixture = createHost();
    const [, second, third] = fixture.componentInstance.group().accordions();

    second?.open();
    third?.open();
    fixture.detectChanges();
    expect(openStates(fixture)).toEqual([false, true, true]);

    fixture.componentInstance.autoCloseOthers.set(true);
    fixture.detectChanges();

    expect(openStates(fixture)).toEqual([false, true, false]);
  });

  it('unregisters a removed accordion', () => {
    const fixture = createHost();

    expect(fixture.componentInstance.group().accordions().length).toBe(3);

    fixture.componentInstance.sections.set(['first', 'second']);
    fixture.detectChanges();

    expect(fixture.componentInstance.group().accordions().length).toBe(2);
  });

  it('closeAll collapses everything, openAll expands everything (unless single-open)', () => {
    const fixture = createHost();
    const group = fixture.componentInstance.group();

    group.openAll();
    fixture.detectChanges();
    expect(openStates(fixture)).toEqual([true, true, true]);

    group.closeAll();
    fixture.detectChanges();
    expect(openStates(fixture)).toEqual([false, false, false]);

    fixture.componentInstance.autoCloseOthers.set(true);
    fixture.detectChanges();
    group.openAll();
    fixture.detectChanges();
    expect(openStates(fixture)).toEqual([false, false, false]);
  });

  it('moves focus between headers with the arrow keys, wrapping around', () => {
    const fixture = createHost();
    const triggers = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      '.et-accordion-trigger',
    );

    triggers[0]?.focus();
    triggers[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(triggers[1]);

    triggers[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(triggers[2]);

    triggers[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(triggers[0]);

    triggers[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(document.activeElement).toBe(triggers[2]);
  });
});
