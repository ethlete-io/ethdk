import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { COLLAPSE_IMPORTS, CollapseComponent, CollapseDirective } from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-shipping-details',
  imports: [COLLAPSE_IMPORTS],
  template: `
    <button (click)="open.set(!open())" type="button">Toggle</button>
    <et-collapse [open]="open()"><p>Delivery takes two to four days.</p></et-collapse>
  `,
})
class ShippingDetailsComponent {
  open = signal(false);
}

@Component({
  selector: 'et-scenario-custom-panel',
  imports: [CollapseDirective],
  template: `<div etCollapse open>Panel</div>`,
})
class CustomPanelComponent {}

describe('collapse scenarios', () => {
  const scenario = useScenario();

  it('opens and closes the details, animating only after the first frame', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ShippingDetailsComponent);
    const collapse = (fixture.nativeElement as HTMLElement).querySelector('et-collapse')!;

    s.tick();

    expect(collapse.classList).toContain('et-collapse');
    expect(collapse.hasAttribute('inert')).toBe(true);
    expect(collapse.hasAttribute('data-open')).toBe(false);

    s.flush();

    fixture.componentInstance.open.set(true);
    s.tick();

    expect(collapse.hasAttribute('inert')).toBe(false);
    expect(collapse.hasAttribute('data-open')).toBe(true);
    expect(collapse.hasAttribute('data-can-animate')).toBe(true);
  });

  it('serves the headless directive on a plain element', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomPanelComponent);
    const panel = (fixture.nativeElement as HTMLElement).querySelector('div')!;

    s.tick();

    expect(panel.hasAttribute('data-open')).toBe(true);
    expect(panel.hasAttribute('inert')).toBe(false);
    expect(CollapseComponent).toBeDefined();
  });
});
