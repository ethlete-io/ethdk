import { Component, ElementRef, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { signalElementDimensions, signalElementMutations } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-required-dimensions',
  template: '<div #box></div>',
})
class ScenarioRequiredDimensionsComponent {
  box = viewChild.required<ElementRef<HTMLElement>>('box');
  dimensions = signalElementDimensions(this.box);
}

@Component({
  selector: 'et-scenario-mutations',
  template: '<div #list></div>',
})
class ScenarioMutationsComponent {
  list = viewChild.required<ElementRef<HTMLElement>>('list');
  mutations = signalElementMutations(this.list, { childList: true, attributes: true });
}

describe('element observers scenario', () => {
  const scenario = useScenario();

  it('binds signalElementDimensions to a viewChild.required without reading it during construction', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ScenarioRequiredDimensionsComponent);

    s.flush();

    expect(fixture.componentInstance.dimensions().client).toEqual({ width: 0, height: 0 });

    fixture.destroy();
  });

  it('reports every record of a mutation batch', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ScenarioMutationsComponent);

    s.flush();

    expect(fixture.componentInstance.mutations()).toEqual([]);

    const list = fixture.componentInstance.list().nativeElement;
    list.appendChild(document.createElement('span'));
    list.appendChild(document.createElement('span'));
    list.setAttribute('data-count', '2');

    await s.settle();

    expect(fixture.componentInstance.mutations().map((record) => record.type)).toEqual([
      'childList',
      'childList',
      'attributes',
    ]);

    fixture.destroy();
  });
});
