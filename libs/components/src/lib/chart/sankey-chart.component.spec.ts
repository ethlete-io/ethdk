import { vi } from 'vitest';
import { Component, ErrorHandler, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorPalette } from '@ethlete/core';
import '../../test-helpers';
import { ChartPlotDirective } from './headless/chart-plot.directive';
import {
  defaultSankeyChartLinkKeyHint,
  SankeyChartDirection,
  SankeyChartDirective,
  SankeyChartLinkInput,
  SankeyChartLinkKeyHint,
  SankeyChartNodeInput,
} from './headless/sankey-chart.directive';
import { SankeyChartComponent, SankeyChartMarkActivateEvent } from './sankey-chart.component';

@Component({
  selector: 'et-test-sankey-chart-host',
  template: `<et-sankey-chart
    [nodes]="nodes()"
    [links]="links()"
    [height]="200"
    [linkSeparator]="separator()"
    [direction]="direction()"
    [linkKeyHint]="keyHint()"
    label="Budget"
  />`,
  imports: [SankeyChartComponent],
})
class SankeyChartHostComponent {
  separator = signal('to');
  direction = signal<SankeyChartDirection | 'auto'>('auto');
  keyHint = signal<SankeyChartLinkKeyHint | null>(defaultSankeyChartLinkKeyHint);
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

const setup = (
  providers: unknown[] = [],
  { width = 600, direction = 'auto' as SankeyChartDirection | 'auto' } = {},
) => {
  TestBed.configureTestingModule({ providers: providers as never[] });

  const fixture = TestBed.createComponent(SankeyChartHostComponent);
  fixture.componentInstance.direction.set(direction);
  fixture.detectChanges();

  const chart = fixture.debugElement.query(By.directive(SankeyChartDirective)).injector.get(SankeyChartDirective);
  const plot = (fixture.nativeElement as HTMLElement).querySelector('.et-sankey-chart-plot');
  chart.plot.set({ width: signal(width), element: plot } as unknown as ChartPlotDirective);
  fixture.detectChanges();

  return { fixture, chart, element: fixture.nativeElement as HTMLElement };
};

const mark = (element: HTMLElement, name: string) =>
  element.querySelector(`[role="img"][aria-label="${name}"]`) as SVGElement;

const press = (fixture: { detectChanges: () => void }, target: Element, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });

  target.dispatchEvent(event);
  fixture.detectChanges();

  return event;
};

const highlightedNames = (element: HTMLElement) =>
  [...element.querySelectorAll('.et-sankey-chart-link[data-highlighted]')].map((link) =>
    link.getAttribute('aria-label'),
  );

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

  it('gives the chart one tab stop, on the first node', () => {
    const { element, chart } = setup();
    const stops = [...element.querySelectorAll('[tabindex="0"]')];

    expect(stops).toHaveLength(1);
    expect(stops[0]?.getAttribute('aria-label')).toBe(chart.renderedNodes()[0]?.name);
    expect(element.querySelectorAll('.et-sankey-chart-node[tabindex="-1"]')).toHaveLength(4);
    expect(element.querySelectorAll('.et-sankey-chart-link[tabindex="-1"]')).toHaveLength(4);
  });

  it('walks the nodes with the arrow keys and moves the tab stop along', () => {
    const { fixture, element, chart } = setup();
    const [first, second] = chart.renderedNodes();

    press(fixture, mark(element, first?.name ?? ''), 'ArrowDown');
    expect(document.activeElement).toBe(mark(element, second?.name ?? ''));

    press(fixture, mark(element, second?.name ?? ''), 'ArrowRight');
    expect(document.activeElement).toBe(mark(element, 'Budget'));
    expect(mark(element, 'Budget').getAttribute('tabindex')).toBe('0');
    expect(element.querySelectorAll('[tabindex="0"]')).toHaveLength(1);

    press(fixture, mark(element, 'Budget'), 'ArrowLeft');
    expect(document.activeElement?.classList.contains('et-sankey-chart-node')).toBe(true);
    expect(
      chart.renderedNodes().find((node) => node.name === document.activeElement?.getAttribute('aria-label'))?.column,
    ).toBe(0);
  });

  it('steps into the outgoing links with Enter, cycles them with the arrows and returns with Escape', () => {
    const { fixture, element, chart } = setup();
    const outgoing = chart.renderedLinks().filter((link) => link.source.key === 'c');

    mark(element, 'Budget').focus();
    fixture.detectChanges();

    press(fixture, mark(element, 'Budget'), 'Enter');
    expect(document.activeElement).toBe(mark(element, outgoing[0]?.name ?? ''));
    expect(highlightedNames(element)).toEqual([outgoing[0]?.name]);

    press(fixture, document.activeElement as SVGElement, 'ArrowDown');
    expect(document.activeElement).toBe(mark(element, outgoing[1]?.name ?? ''));

    press(fixture, document.activeElement as SVGElement, 'ArrowDown');
    expect(document.activeElement).toBe(mark(element, outgoing[0]?.name ?? ''));

    press(fixture, document.activeElement as SVGElement, 'Escape');
    expect(document.activeElement).toBe(mark(element, 'Budget'));
  });

  describe('link key hint', () => {
    const enterBudgetLinks = async (fixture: { detectChanges: () => void }, element: HTMLElement) => {
      mark(element, 'Budget').focus();
      press(fixture, mark(element, 'Budget'), 'Enter');
      await Promise.resolve();
      fixture.detectChanges();
    };

    it('writes the position, the keys and the source of a keyboard-focused link', async () => {
      const { fixture, element, chart } = setup();
      const outgoing = chart.renderedLinks().filter((link) => link.source.key === 'c');

      await enterBudgetLinks(fixture, element);
      expect(chart.linkKeyHintText()).toEqual({
        key: outgoing[0]?.key,
        text: '1 of 2 · ↑↓ next link · Esc back to Budget',
      });

      press(fixture, document.activeElement as SVGElement, 'ArrowDown');
      await Promise.resolve();
      expect(chart.linkKeyHintText()?.text).toBe('2 of 2 · ↑↓ next link · Esc back to Budget');
    });

    it('drops the next-link keys for a lone link and names ←→ in a vertical flow', async () => {
      const { fixture, element, chart } = setup([], { direction: 'vertical' });

      await enterBudgetLinks(fixture, element);
      expect(chart.linkKeyHintText()?.text).toBe('1 of 2 · ←→ next link · Esc back to Budget');

      mark(element, 'Sponsors').focus();
      press(fixture, mark(element, 'Sponsors'), 'Enter');
      await Promise.resolve();
      expect(chart.linkKeyHintText()?.text).toBe('1 of 1 · Esc back to Sponsors');
    });

    it('shows no hint for a link focused by a pointer or on a node', async () => {
      const { fixture, element, chart } = setup();
      const link = mark(element, 'Sponsors to Budget');

      mark(element, 'Budget').focus();
      press(fixture, mark(element, 'Budget'), 'ArrowUp');
      await Promise.resolve();
      expect(chart.linkKeyHintText()).toBeNull();

      link.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      link.focus();
      await Promise.resolve();
      expect(chart.linkKeyHintText()).toBeNull();
    });

    it('takes the text from linkKeyHint and shows none when it is null', async () => {
      const { fixture, element, chart } = setup();

      fixture.componentInstance.keyHint.set(
        ({ position, count, sourceLabel }) => `${position}/${count} · Esc zurück zu ${sourceLabel}`,
      );
      await enterBudgetLinks(fixture, element);
      expect(chart.linkKeyHintText()?.text).toBe('1/2 · Esc zurück zu Budget');

      fixture.componentInstance.keyHint.set(null);
      fixture.detectChanges();
      expect(chart.linkKeyHintText()).toBeNull();
    });
  });

  it('keeps the focus on a node without outgoing links on Enter', () => {
    const { fixture, element } = setup();
    const salaries = mark(element, 'Salaries');

    salaries.focus();
    press(fixture, salaries, 'Enter');

    expect(document.activeElement).toBe(salaries);
  });

  it('describes a node by what flows in and out, and a link by its value', () => {
    const { chart, element } = setup();
    const budget = chart.renderedNodes().find((node) => node.key === 'c');
    const tickets = chart.renderedNodes().find((node) => node.key === 'a');
    const link = element.querySelector('[aria-label="Sponsors to Budget"]');

    expect(budget?.description).toBe('In: 1,300, Out: 1,300');
    expect(tickets?.description).toBe('Out: 300');
    expect(link).not.toBeNull();
    expect(chart.renderedLinks().find((entry) => entry.name === 'Sponsors to Budget')?.valueText).toBe('1,000');
  });

  it('puts first-column labels before their node and the last column after it', () => {
    const { chart } = setup();
    const [first, , middle, last] = chart.renderedNodes();

    expect(first?.labelSide).toBe('start');
    expect(first?.labelX).toBeLessThan(first?.x ?? 0);
    expect(first?.labelMaxWidth).toBe(120 - 12);
    expect(middle?.labelSide).toBe('center');
    expect(last?.labelSide).toBe('end');
    expect(last?.labelX).toBeGreaterThan((last?.x ?? 0) + (last?.width ?? 0));
  });

  it('centres a chip on a middle-column node of 24px or more and keeps short ones beside the node', () => {
    const { chart } = setup();
    const nodes = chart.renderedNodes();
    const budget = nodes.find((node) => node.name === 'Budget');

    expect(budget?.labelSide).toBe('center');
    expect(budget?.labelX).toBe((budget?.x ?? 0) + (budget?.width ?? 0) / 2);
    expect(budget?.labelY).toBe((budget?.y ?? 0) + (budget?.height ?? 0) / 2);
    expect(nodes.filter((node) => node.column === 0).every((node) => node.labelSide === 'start')).toBe(true);
    expect(nodes.filter((node) => node.column === 2).every((node) => node.labelSide === 'end')).toBe(true);
  });

  it('keeps the label beside a middle-column node shorter than 24px', () => {
    const { fixture, chart } = setup();
    fixture.componentInstance.nodes.update((nodes) => [...nodes, { id: 'm', label: 'Minor' }]);
    fixture.componentInstance.links.set([
      { source: 'a', target: 'c', value: 1000 },
      { source: 'c', target: 'e', value: 1000 },
      { source: 'a', target: 'm', value: 5 },
      { source: 'm', target: 'e', value: 5 },
    ]);
    fixture.detectChanges();

    const minor = chart.renderedNodes().find((node) => node.name === 'Minor');

    expect(minor?.height).toBeLessThan(24);
    expect(minor?.labelSide).toBe('end');
    expect(minor?.labelX).toBe((minor?.x ?? 0) + (minor?.width ?? 0) + 6);
  });

  describe('direction', () => {
    afterEach(() => vi.restoreAllMocks());

    const hostWidth = (width: number) =>
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.classList.contains('et-sankey-chart-scroller') ? width : 0;
      });

    it('turns the flow vertical while the host is narrower than 480px', async () => {
      hostWidth(360);
      const { fixture, chart, element } = setup([], { width: 360 });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(chart.flowDirection()).toBe('vertical');
      expect(element.querySelector('et-sankey-chart')?.getAttribute('data-direction')).toBe('vertical');
    });

    it('keeps the flow horizontal from 480px and when the direction is set explicitly', async () => {
      hostWidth(480);
      const wide = setup();
      await wide.fixture.whenStable();

      expect(wide.chart.flowDirection()).toBe('horizontal');

      TestBed.resetTestingModule();
      hostWidth(360);
      const forced = setup([], { width: 360, direction: 'horizontal' });
      await forced.fixture.whenStable();

      expect(forced.chart.flowDirection()).toBe('horizontal');
    });

    it('lays columns out as rows, the first labelled above and the last below', () => {
      const { chart } = setup([], { width: 360, direction: 'vertical' });
      const nodes = chart.renderedNodes();
      const budget = nodes.find((node) => node.name === 'Budget');
      const firstRow = nodes.filter((node) => node.column === 0);
      const lastRow = nodes.filter((node) => node.column === 2);

      expect(new Set(firstRow.map((node) => node.y)).size).toBe(1);
      expect(budget?.y).toBeGreaterThan(firstRow[0]?.y ?? 0);
      expect(budget?.height).toBe(12);
      expect(budget?.labelSide).toBe('center');
      expect(budget?.labelX).toBe((budget?.x ?? 0) + (budget?.width ?? 0) / 2);

      for (const node of firstRow) {
        expect(node.labelSide).toBe('start');
        expect(node.labelX).toBe(node.x + node.width / 2);
        expect(node.labelY).toBe(node.y - 6);
      }

      for (const node of lastRow) {
        expect(node.labelSide).toBe('end');
        expect(node.labelY).toBe(node.y + node.height + 6);
        expect(node.labelX - node.labelMaxWidth / 2).toBeGreaterThanOrEqual(0);
        expect(node.labelX + node.labelMaxWidth / 2).toBeLessThanOrEqual(360);
      }

      const [left, right] = firstRow;

      expect((left?.labelX ?? 0) + (left?.labelMaxWidth ?? 0) / 2).toBeLessThanOrEqual(
        (right?.labelX ?? 0) - (right?.labelMaxWidth ?? 0) / 2,
      );
    });

    it('walks rows with up and down, a row with left and right, and cycles links with left and right', () => {
      const { fixture, element, chart } = setup([], { width: 360, direction: 'vertical' });
      const [first, second] = chart.renderedNodes();
      const outgoing = chart.renderedLinks().filter((link) => link.source.key === 'c');

      press(fixture, mark(element, first?.name ?? ''), 'ArrowRight');
      expect(document.activeElement).toBe(mark(element, second?.name ?? ''));

      press(fixture, mark(element, second?.name ?? ''), 'ArrowDown');
      expect(document.activeElement).toBe(mark(element, 'Budget'));

      press(fixture, mark(element, 'Budget'), 'Enter');
      expect(document.activeElement).toBe(mark(element, outgoing[0]?.name ?? ''));
      expect((outgoing[0]?.anchor.x ?? 0) < (outgoing[1]?.anchor.x ?? 0)).toBe(true);

      press(fixture, document.activeElement as SVGElement, 'ArrowRight');
      expect(document.activeElement).toBe(mark(element, outgoing[1]?.name ?? ''));

      press(fixture, document.activeElement as SVGElement, 'Escape');
      press(fixture, mark(element, 'Budget'), 'ArrowUp');
      expect(
        chart.renderedNodes().find((node) => node.name === document.activeElement?.getAttribute('aria-label'))?.column,
      ).toBe(0);
    });
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

  it('steps the accent for nodes past the palette and gives links their source accent', () => {
    const { chart } = setup();
    const nodes = chart.renderedNodes();

    expect(nodes.map((node) => node.accentMix)).toEqual([100, 85, 70, 55, 40]);

    for (const link of chart.renderedLinks()) expect(link.accentMix).toBe(link.source.accentMix);
  });

  it('steps the accent only across nodes without a color theme', () => {
    const { chart } = setup([PALETTE]);
    const nodes = chart.renderedNodes();

    expect(nodes.find((node) => node.key === 'a')?.accentMix).toBeNull();
    expect(nodes.find((node) => node.key === 'b')?.accentMix).toBeNull();
    expect(nodes.filter((node) => node.colorToken === null).map((node) => node.accentMix)).toEqual([100, 70, 40]);
  });

  it('joins a link name with the link separator', () => {
    const { fixture, chart } = setup();

    expect(chart.renderedLinks().some((link) => link.name === 'Sponsors to Budget')).toBe(true);

    fixture.componentInstance.separator.set('nach');
    fixture.detectChanges();

    expect(chart.renderedLinks().some((link) => link.name === 'Sponsors nach Budget')).toBe(true);
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
    expect(highlighted).toEqual(['Tickets to Budget']);

    tickets.dispatchEvent(new FocusEvent('blur'));
    fixture.detectChanges();

    expect(svg.hasAttribute('data-highlight')).toBe(false);
  });

  it('highlights only the hovered link, and ignores a touch pointer', () => {
    const { fixture, element } = setup();
    const link = element.querySelector('[aria-label="Budget to Travel"]') as SVGElement;

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

  it('reports ET5160 when the links form a cycle and draws nothing', () => {
    const handleError = vi.fn();
    const { fixture, element } = setup([{ provide: ErrorHandler, useValue: { handleError } }]);

    fixture.componentInstance.links.update((links) => [...links, { source: 'd', target: 'a', value: 5 }]);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(String(handleError.mock.calls[0]?.[0])).toMatch(/ET5160/);
    expect(element.querySelector('.et-sankey-chart-node, .et-sankey-chart-link')).toBeNull();
  });
});

describe('SankeyChartComponent markActivate', () => {
  const listen = (result: ReturnType<typeof setup>) => {
    const emitted: SankeyChartMarkActivateEvent[] = [];

    result.fixture.debugElement
      .query(By.directive(SankeyChartComponent))
      .injector.get(SankeyChartComponent)
      .markActivate.subscribe((event) => emitted.push(event));

    return emitted;
  };

  it('emits the node or link input on click', () => {
    const result = setup();
    const emitted = listen(result);
    const host = result.fixture.componentInstance;

    mark(result.element, 'Tickets').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    result.element.querySelector('.et-sankey-chart-link')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(emitted[0]).toEqual({ kind: 'node', node: host.nodes()[0] });
    expect(emitted[1]?.kind).toBe('link');
    expect(host.links()).toContain(emitted[1]?.kind === 'link' ? emitted[1].link : null);
  });

  it('emits on Space, and on Enter only where Enter does not step into a node’s links', () => {
    const result = setup();
    const emitted = listen(result);
    const host = result.fixture.componentInstance;

    expect(press(result.fixture, mark(result.element, 'Salaries'), 'Enter').defaultPrevented).toBe(true);
    expect(press(result.fixture, mark(result.element, 'Tickets'), ' ').defaultPrevented).toBe(true);
    press(result.fixture, mark(result.element, 'Tickets'), 'Enter');

    expect(emitted).toEqual([
      { kind: 'node', node: host.nodes()[3] },
      { kind: 'node', node: host.nodes()[0] },
    ]);

    const link = result.element.querySelector('.et-sankey-chart-link') as SVGElement;
    press(result.fixture, link, 'Enter');

    expect(emitted[2]?.kind).toBe('link');
  });
});
