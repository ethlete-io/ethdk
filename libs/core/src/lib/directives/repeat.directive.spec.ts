import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RepeatDirective } from './repeat.directive';

@Component({
  imports: [RepeatDirective],
  template: `<span *etRepeat="count()" class="item"></span>`,
})
class HostComponent {
  count = signal<number | string>(3);
}

describe('RepeatDirective', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const items = () => (fixture.nativeElement as HTMLElement).querySelectorAll('.item').length;
    const set = (value: number | string) => {
      fixture.componentInstance.count.set(value);
      fixture.detectChanges();
    };
    return { fixture, items, set };
  };

  it('renders the template the given number of times and follows changes', () => {
    const { items, set } = setup();

    expect(items()).toBe(3);

    set(5);
    expect(items()).toBe(5);

    set(1);
    expect(items()).toBe(1);
  });

  it('renders nothing for zero, -0 and negative counts', () => {
    const { items, set } = setup();

    set(0);
    expect(items()).toBe(0);

    set(2);
    set(-0);
    expect(items()).toBe(0);

    set(2);
    set(-4);
    expect(items()).toBe(0);
  });

  it('renders nothing for a non-numeric count', () => {
    const { items, set } = setup();

    set('abc');
    expect(items()).toBe(0);
  });

  it('can be destroyed before its first change detection', () => {
    const fixture = TestBed.createComponent(HostComponent);

    expect(() => fixture.destroy()).not.toThrow();
  });
});
