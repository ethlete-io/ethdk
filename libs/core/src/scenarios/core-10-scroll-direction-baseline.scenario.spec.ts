import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { signalElementLastScrollDirection } from '../index';
import { useScenario } from './harness';

@Component({ selector: 'et-scenario-scroll-direction', template: '' })
class ScrollDirectionComponent {
  target = signal<HTMLElement | null>(null);
  direction = signalElementLastScrollDirection(this.target);
}

const scrolledElement = (scrollTop: number) => {
  const el = document.createElement('div');
  el.scrollTop = scrollTop;
  return el;
};

const scrollTo = (el: HTMLElement, scrollTop: number) => {
  el.scrollTop = scrollTop;
  el.dispatchEvent(new Event('scroll'));
};

describe('element scroll direction baseline scenarios', () => {
  const scenario = useScenario();

  it('measures the first scroll against the position the element was bound at', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ScrollDirectionComponent);
    const { target, direction } = fixture.componentInstance;
    const list = scrolledElement(500);

    target.set(list);
    s.tick();

    scrollTo(list, 490);

    expect(direction()?.type).toBe('up');

    fixture.destroy();
  });

  it('re-seeds the baseline when the bound element is swapped for a scrolled one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ScrollDirectionComponent);
    const { target, direction } = fixture.componentInstance;
    const first = scrolledElement(0);
    const second = scrolledElement(800);

    target.set(first);
    s.tick();
    scrollTo(first, 100);

    expect(direction()?.type).toBe('down');

    target.set(second);
    s.tick();
    scrollTo(second, 790);

    expect(direction()?.type).toBe('up');

    fixture.destroy();
  });
});
