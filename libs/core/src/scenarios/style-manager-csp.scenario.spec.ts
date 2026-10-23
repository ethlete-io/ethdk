import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectStyleManager } from '../index';
import { useScenario } from './harness';

@Component({ selector: 'et-scenario-mounted-styles', template: '', styles: '.et-scenario-mounted { color: red; }' })
class MountedStylesComponent {}

@Component({ selector: 'et-scenario-style-user', template: '' })
class StyleUserComponent {
  constructor() {
    injectStyleManager().mount(MountedStylesComponent);
  }
}

describe('style manager scenarios', () => {
  const scenario = useScenario();

  it('hides its container without a style attribute, which a strict CSP blocks', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StyleUserComponent);

    s.tick();

    const container = document.querySelector<HTMLElement>('.et-style-manager');

    expect(container?.hidden).toBe(true);
    expect(document.querySelectorAll('.et-style-manager [style], .et-style-manager[style]')).toHaveLength(0);

    fixture.destroy();
  });
});
