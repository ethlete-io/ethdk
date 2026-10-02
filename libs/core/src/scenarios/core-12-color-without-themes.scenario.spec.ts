import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProvideColorDirective } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-unthemed',
  imports: [ProvideColorDirective],
  template: `<div [etProvideColor]="name()"></div>`,
})
class UnthemedComponent {
  name = signal('brand');
}

describe('etProvideColor without registered themes scenarios', () => {
  const scenario = useScenario();

  it('warns once, naming the provider function, when a theme name is bound and no themes exist', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(UnthemedComponent);

    s.tick();
    fixture.componentInstance.name.set('danger');
    s.tick();

    s.expectWarning('provideColorThemesWithTailwind4');
    expect(s.warnings).toEqual([]);

    fixture.destroy();
  });
});
