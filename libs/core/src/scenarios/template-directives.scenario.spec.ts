import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ClickOutsideDirective, OVERLAY_LAYER_ATTRIBUTE, RepeatDirective } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-skeleton-list',
  imports: [RepeatDirective],
  template: `
    <ul class="default">
      <li *etRepeat class="row"></li>
    </ul>
    <ul class="fixed">
      <li *etRepeat="'3'" class="row"></li>
    </ul>
    <ul class="bound">
      <li *etRepeat="rows()" class="row"></li>
    </ul>
  `,
})
class SkeletonListComponent {
  rows = signal(4);
}

@Component({
  selector: 'et-scenario-dropdown',
  imports: [ClickOutsideDirective],
  template: `
    @if (open()) {
      <div (etClickOutside)="close($event)" class="panel">
        <button class="inside" type="button"><span class="label">Pick</span></button>
      </div>
    }
    <button class="outside" type="button">Elsewhere</button>
    <div class="widget" ${OVERLAY_LAYER_ATTRIBUTE}="2147483100">
      <button class="in-widget" type="button">Widget</button>
    </div>
  `,
})
class DropdownComponent {
  open = signal(true);
  closedBy: EventTarget[] = [];

  close(event: MouseEvent) {
    if (event.target) this.closedBy.push(event.target);
    this.open.set(false);
  }
}

const rows = (host: HTMLElement, list: string) => host.querySelectorAll(`ul.${list} > li.row`).length;

const click = (host: HTMLElement, selector: string) => {
  const element = host.querySelector<HTMLElement>(selector);

  if (!element) throw new Error(`${selector} is not rendered`);

  element.click();

  return element;
};

describe('template directive scenarios', () => {
  const scenario = useScenario();

  it('stamps a template a default, static or bound number of times and follows the count', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(SkeletonListComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    expect(rows(host, 'default')).toBe(2);
    expect(rows(host, 'fixed')).toBe(3);
    expect(rows(host, 'bound')).toBe(4);

    const [first] = host.querySelectorAll('ul.bound > li.row');

    fixture.componentInstance.rows.set(1);
    s.tick();

    expect(rows(host, 'bound')).toBe(1);
    expect(host.querySelector('ul.bound > li.row')).toBe(first);

    fixture.componentInstance.rows.set(-2);
    s.tick();

    expect(rows(host, 'bound')).toBe(0);

    fixture.componentInstance.rows.set(6);
    s.tick();

    expect(rows(host, 'bound')).toBe(6);
  });

  it('closes on a click outside the host, but not on one inside it or on a higher overlay layer', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(DropdownComponent);
    const host = fixture.nativeElement as HTMLElement;
    const dropdown = fixture.componentInstance;

    s.tick();

    click(host, '.label');
    click(host, '.in-widget');
    s.tick();

    expect(dropdown.open()).toBe(true);
    expect(dropdown.closedBy).toEqual([]);

    const outside = click(host, '.outside');
    s.tick();

    expect(dropdown.open()).toBe(false);
    expect(dropdown.closedBy).toEqual([outside]);

    click(host, '.outside');
    s.tick();

    expect(dropdown.closedBy).toEqual([outside]);

    dropdown.open.set(true);
    s.tick();
    document.documentElement.click();
    s.tick();

    expect(dropdown.open()).toBe(false);
    expect(dropdown.closedBy).toEqual([outside, document.documentElement]);

    fixture.destroy();
  });
});
