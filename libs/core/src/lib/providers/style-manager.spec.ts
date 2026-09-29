import { Component, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectStyleManager } from './style-manager';

@Component({
  selector: 'et-test-styles-a',
  template: '',
  styles: '.a { color: red }',
  encapsulation: ViewEncapsulation.None,
})
class StylesAComponent {}

@Component({
  selector: 'et-test-styles-b',
  template: '',
  styles: '.b { color: blue }',
  encapsulation: ViewEncapsulation.None,
})
class StylesBComponent {}

describe('StyleManager', () => {
  const containers = () => document.querySelectorAll('.et-style-manager');

  it('mounts a component type once however often it is requested', () => {
    const manager = TestBed.runInInjectionContext(() => injectStyleManager());

    const first = manager.mount(StylesAComponent);
    const second = manager.mount(StylesAComponent);

    expect(second).toBe(first);
    expect(document.querySelectorAll('et-test-styles-a')).toHaveLength(1);
    expect(containers()).toHaveLength(1);
  });

  it('shares one hidden container between component types', () => {
    const manager = TestBed.runInInjectionContext(() => injectStyleManager());

    manager.mount(StylesAComponent);
    manager.mount(StylesBComponent);

    const container = containers()[0] as HTMLElement;
    expect(containers()).toHaveLength(1);
    expect(container.getAttribute('aria-hidden')).toBe('true');
    expect(container.style.display).toBe('none');
    expect(container.children).toHaveLength(2);
  });

  it('removes the container and components on destroy', () => {
    const manager = TestBed.runInInjectionContext(() => injectStyleManager());
    manager.mount(StylesAComponent);
    expect(containers()).toHaveLength(1);

    TestBed.resetTestingModule();

    expect(containers()).toHaveLength(0);
  });
});
