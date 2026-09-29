import { Component, ElementRef, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { applyHostListener, applyHostListeners, createRxHostListener } from './host-listener';

@Component({
  selector: 'et-test-host-listener',
  template: '',
})
class HostListenerComponent {
  element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  clicks: Event[] = [];
  keys: string[] = [];
  onceClicks = 0;
  rx$ = createRxHostListener('click');

  constructor() {
    applyHostListeners({
      click: (event) => this.clicks.push(event),
      keydown: (event) => this.keys.push(event.key),
    });
    applyHostListener('focus', () => this.onceClicks++, { once: true });
  }
}

describe('host listeners', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostListenerComponent);
    return { fixture, host: fixture.componentInstance };
  };

  it('invokes every handler passed to applyHostListeners for its own event', () => {
    const { host } = setup();

    host.element.dispatchEvent(new MouseEvent('click'));
    host.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

    expect(host.clicks).toHaveLength(1);
    expect(host.keys).toEqual(['a']);
  });

  it('forwards listener options to applyHostListener', () => {
    const { host } = setup();

    host.element.dispatchEvent(new FocusEvent('focus'));
    host.element.dispatchEvent(new FocusEvent('focus'));

    expect(host.onceClicks).toBe(1);
  });

  it('emits from createRxHostListener until the component is destroyed', () => {
    const { fixture, host } = setup();
    const seen: Event[] = [];
    let completed = false;

    host.rx$.subscribe({ next: (event) => seen.push(event), complete: () => (completed = true) });
    host.element.dispatchEvent(new MouseEvent('click'));

    expect(seen).toHaveLength(1);

    fixture.destroy();

    expect(completed).toBe(true);
  });

  it('stops all handlers after destroy', () => {
    const { fixture, host } = setup();

    fixture.destroy();
    host.element.dispatchEvent(new MouseEvent('click'));

    expect(host.clicks).toHaveLength(0);
  });
});
