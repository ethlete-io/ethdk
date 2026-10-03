import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { SankeyChartMarkDirective } from './sankey-chart-mark.directive';
import { SankeyChartDirective } from './sankey-chart.directive';

@Component({
  selector: 'et-test-sankey-chart-mark-host',
  template: `<svg [nodes]="nodes" [links]="[]" etSankeyChart label="Budget">
    <svg:g etSankeyChartMark="node" etSankeyChartMarkKey="a" aria-label="Tickets" />
  </svg>`,
  imports: [SankeyChartDirective, SankeyChartMarkDirective],
})
class SankeyChartMarkHostComponent {
  nodes = [{ id: 'a', label: 'Tickets' }];
}

describe('SankeyChartMarkDirective', () => {
  it('gives a custom-template mark the img role', () => {
    const fixture = TestBed.createComponent(SankeyChartMarkHostComponent);
    fixture.detectChanges();

    const mark = (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Tickets"]');

    expect(mark?.getAttribute('role')).toBe('img');
  });
});
