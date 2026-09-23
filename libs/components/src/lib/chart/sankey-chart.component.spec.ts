import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorPalette } from '@ethlete/core';
import '../../test-helpers';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import { SankeyChartDirective, SankeyChartLinkInput, SankeyChartNodeInput } from './headless/sankey-chart.directive';
import { SankeyChartComponent } from './sankey-chart.component';

@Component({
  selector: 'et-test-sankey-chart-host',
  template: `<et-sankey-chart [nodes]="nodes()" [links]="links()" [height]="200" label="Budget" />`,
  imports: [SankeyChartComponent],
})
class SankeyChartHostComponent {
  nodes = signal<SankeyChartNodeInput[]>([
    { id: 'a', label: 'Tickets' },
    { id: 'b', label: 'Sponsors' },
    { id: 'c', label: 'Budget' },
    { id: 'd', label: 'Salaries' },
    { id: 'e', label: 'Travel' },
  ]);
  links = signal<SankeyChartLinkInput[]>([
    { source: 'a', target: 'c', value: 300 },
    { source: 'b', target: 'c', value: 1000 },
    { source: 'c', target: 'd', value: 1100 },
    { source: 'c', target: 'e', value: 200 },
    { source: 'a', target: 'e', value: 0 },
  ]);
}

const setup = (providers: unknown[] = []) => {
  TestBed.configureTestingModule({ providers: providers as never[] });

  const fixture = TestBed.createComponent(SankeyChartHostComponent);
  fixture.detectChanges();

  const chart = fixture.debugElement.query(By.directive(SankeyChartDirective)).injector.get(SankeyChartDirective);
  chart.plot.set({ width: signal(600) } as unknown as ChartPlotDirective);
  fixture.detectChanges();

  return { fixture, chart, element: fixture.nativeElement as HTMLElement };
};

const PALETTE = provideColorPalette([
  { token: 'ocean', label: 'Ocean' },
  { token: 'sunset', label: 'Sunset' },
]);

describe('SankeyChartComponent', () => {
  it('renders a node mark per node and a ribbon per positive link', () => {
    const { element } = setup();

    expect(element.querySelectorAll('.et-sankey-chart-node')).toHaveLength(5);
    expect(element.querySelectorAll('.et-sankey-chart-link')).toHaveLength(4);
  });

  it('orders nodes column by column, top to bottom, and names each by its label', () => {
    const { element, chart } = setup();
    const names = [...element.querySelectorAll('.et-sankey-chart-node')].map((node) => node.getAttribute('aria-label'));
    const nodes = chart.renderedNodes();

    expect(names).toEqual(nodes.map((node) => node.name));
    expect(nodes.map((node) => node.column)).toEqual([0, 0, 1, 2, 2]);

    for (let i = 1; i < nodes.length; i++) {
      const previous = nodes[i - 1];
      const current = nodes[i];

      if (previous && current && previous.column === current.column) expect(current.y).toBeGreaterThan(previous.y);
    }
  });

  it('makes every node and link a tab stop, nodes before links', () => {
    const { element } = setup();
    const marks = [...element.querySelectorAll('[tabindex="0"]')];

    expect(marks).toHaveLength(9);
    expect(marks.slice(0, 5).every((mark) => mark.classList.contains('et-sankey-chart-node'))).toBe(true);
    expect(marks.slice(5).every((mark) => mark.classList.contains('et-sankey-chart-link'))).toBe(true);
  });

  it('describes a node by what flows in and out, and a link by its value', () => {
    const { chart, element } = setup();
    const budget = chart.renderedNodes().find((node) => node.key === 'c');
    const tickets = chart.renderedNodes().find((node) => node.key === 'a');
    const link = element.querySelector('[aria-label="Sponsors → Budget"]');

    expect(budget?.description).toBe('In: 1,300, Out: 1,300');
    expect(tickets?.description).toBe('Out: 300');
    expect(link).not.toBeNull();
    expect(chart.renderedLinks().find((entry) => entry.name === 'Sponsors → Budget')?.valueText).toBe('1,000');
  });

  it('puts first-column labels before their node and the others after it', () => {
    const { chart } = setup();
    const [first, , middle, last] = chart.renderedNodes();

    expect(first?.labelSide).toBe('start');
    expect(first?.labelX).toBeLessThan(first?.x ?? 0);
    expect(first?.labelMaxWidth).toBe(120 - 12);
    expect(middle?.labelSide).toBe('end');
    expect(last?.labelSide).toBe('end');
    expect(last?.labelX).toBeGreaterThan((last?.x ?? 0) + (last?.width ?? 0));
  });

  it('colors nodes by palette position and links by their source', () => {
    const { chart } = setup([PALETTE]);
    const tickets = chart.renderedNodes().find((node) => node.key === 'a');
    const sponsors = chart.renderedNodes().find((node) => node.key === 'b');
    const budget = chart.renderedNodes().find((node) => node.key === 'c');

    expect(tickets?.colorToken).toBe('ocean');
    expect(sponsors?.colorToken).toBe('sunset');
    expect(budget?.colorToken).toBeNull();
    expect(chart.renderedLinks().find((link) => link.source.key === 'b')?.colorToken).toBe('sunset');
  });

  it('prefers a node colorToken over its palette entry', () => {
    const { fixture, chart } = setup([PALETTE]);

    fixture.componentInstance.nodes.update((nodes) =>
      nodes.map((node) => (node.id === 'a' ? { ...node, colorToken: 'forest' } : node)),
    );
    fixture.detectChanges();

    expect(chart.renderedNodes().find((node) => node.key === 'a')?.colorToken).toBe('forest');
  });

  it('highlights the links of a focused node and dims the rest', () => {
    const { fixture, element } = setup();
    const svg = element.querySelector('.et-sankey-chart-svg') as SVGElement;
    const tickets = element.querySelector('[aria-label="Tickets"]') as SVGElement;

    expect(svg.hasAttribute('data-highlight')).toBe(false);

    tickets.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();

    const highlighted = [...element.querySelectorAll('.et-sankey-chart-link[data-highlighted]')].map((link) =>
      link.getAttribute('aria-label'),
    );

    expect(svg.hasAttribute('data-highlight')).toBe(true);
    expect(tickets.hasAttribute('data-active')).toBe(true);
    expect(highlighted).toEqual(['Tickets → Budget']);

    tickets.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(svg.hasAttribute('data-highlight')).toBe(false);
  });

  it('highlights only the hovered link, and ignores a touch pointer', () => {
    const { fixture, element } = setup();
    const link = element.querySelector('[aria-label="Budget → Travel"]') as SVGElement;

    link.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));
    fixture.detectChanges();

    expect(element.querySelector('.et-sankey-chart-svg')?.hasAttribute('data-highlight')).toBe(false);

    link.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    fixture.detectChanges();

    expect(element.querySelectorAll('.et-sankey-chart-link[data-highlighted]')).toHaveLength(1);
    expect(link.hasAttribute('data-highlighted')).toBe(true);

    link.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    fixture.detectChanges();

    expect(element.querySelector('.et-sankey-chart-svg')?.hasAttribute('data-highlight')).toBe(false);
  });

  it('lists every link in the table view, the zero one included', () => {
    const { chart, element } = setup();

    expect(chart.table()).toEqual({
      columns: ['Source', 'Target', 'Value'],
      rows: [
        { header: 'Tickets', cells: ['Budget', '300'] },
        { header: 'Sponsors', cells: ['Budget', '1,000'] },
        { header: 'Budget', cells: ['Salaries', '1,100'] },
        { header: 'Budget', cells: ['Travel', '200'] },
        { header: 'Tickets', cells: ['Travel', '0'] },
      ],
    });
    expect(element.querySelector('.et-chart-table caption')?.textContent?.trim()).toBe('Budget');
  });

  it('throws ET5160 when the links form a cycle', () => {
    const { fixture } = setup();

    fixture.componentInstance.links.update((links) => [...links, { source: 'd', target: 'a', value: 5 }]);

    expect(() => fixture.detectChanges()).toThrow(/ET5160/);
  });
});
