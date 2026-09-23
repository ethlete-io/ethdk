import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { SankeyChartLinkInput, SankeyChartNodeInput } from '../headless/sankey-chart.directive';
import { SankeyChartComponent } from '../sankey-chart.component';

export type SankeyChartStoryDataset = 'match-day' | 'budget' | 'traffic';

type StoryDataset = {
  label: string;
  nodes: readonly SankeyChartNodeInput[];
  links: readonly SankeyChartLinkInput[];
};

const TRAFFIC_CHANNELS = ['Search', 'Social', 'Newsletter', 'Partners', 'Direct', 'Ads'];
const TRAFFIC_PAGES = ['Fixtures', 'Tickets', 'News', 'Shop', 'Club TV', 'Academy'];
const TRAFFIC_OUTCOMES = ['Ticket bought', 'Shop order', 'Sign-up', 'Video watched', 'Left'];

const trafficLinks = (): SankeyChartLinkInput[] => {
  const links: SankeyChartLinkInput[] = [];

  TRAFFIC_CHANNELS.forEach((channel, c) => {
    TRAFFIC_PAGES.forEach((page, p) => {
      const value = ((c * 7 + p * 5) % 9) * 40 + (c === p ? 600 : 0);

      if (value) links.push({ source: channel, target: page, value });
    });
  });

  TRAFFIC_PAGES.forEach((page, p) => {
    const inflow = links.filter((link) => link.target === page).reduce((sum, link) => sum + link.value, 0);
    const shares = TRAFFIC_OUTCOMES.map((_, o) => (o === p % TRAFFIC_OUTCOMES.length ? 4 : ((p + o) % 3) + 1));
    const total = shares.reduce((sum, share) => sum + share, 0);

    TRAFFIC_OUTCOMES.forEach((outcome, o) => {
      links.push({ source: page, target: outcome, value: Math.round((inflow * (shares[o] ?? 0)) / total) });
    });
  });

  return links;
};

const DATASETS: Record<SankeyChartStoryDataset, StoryDataset> = {
  'match-day': {
    label: 'Match-day revenue and where it goes (k€)',
    nodes: [
      { id: 'tickets', label: 'Tickets' },
      { id: 'catering', label: 'Catering' },
      { id: 'merch', label: 'Merchandise' },
      { id: 'revenue', label: 'Match-day revenue' },
      { id: 'staff', label: 'Stewards and staff' },
      { id: 'security', label: 'Security' },
      { id: 'pitch', label: 'Pitch and facilities' },
      { id: 'reserves', label: 'Reserves' },
    ],
    links: [
      { source: 'tickets', target: 'revenue', value: 420 },
      { source: 'catering', target: 'revenue', value: 150 },
      { source: 'merch', target: 'revenue', value: 90 },
      { source: 'revenue', target: 'staff', value: 210 },
      { source: 'revenue', target: 'security', value: 140 },
      { source: 'revenue', target: 'pitch', value: 120 },
      { source: 'revenue', target: 'reserves', value: 190 },
    ],
  },
  budget: {
    label: 'Club budget by source, department and cost (k€)',
    nodes: [
      { id: 'sponsoring', label: 'Sponsoring' },
      { id: 'tickets', label: 'Tickets' },
      { id: 'media', label: 'Media rights' },
      { id: 'merch', label: 'Merchandise' },
      { id: 'budget', label: 'Budget' },
      { id: 'men', label: "Men's team" },
      { id: 'women', label: "Women's team" },
      { id: 'youth', label: 'Youth academy' },
      { id: 'operations', label: 'Operations' },
      { id: 'salaries', label: 'Salaries' },
      { id: 'travel', label: 'Travel' },
      { id: 'facilities', label: 'Facilities' },
    ],
    links: [
      { source: 'sponsoring', target: 'budget', value: 2400 },
      { source: 'tickets', target: 'budget', value: 1800 },
      { source: 'media', target: 'budget', value: 1300 },
      { source: 'merch', target: 'budget', value: 500 },
      { source: 'budget', target: 'men', value: 3200 },
      { source: 'budget', target: 'women', value: 1200 },
      { source: 'budget', target: 'youth', value: 700 },
      { source: 'budget', target: 'operations', value: 900 },
      { source: 'men', target: 'salaries', value: 2500 },
      { source: 'men', target: 'travel', value: 400 },
      { source: 'men', target: 'facilities', value: 300 },
      { source: 'women', target: 'salaries', value: 850 },
      { source: 'women', target: 'travel', value: 200 },
      { source: 'women', target: 'facilities', value: 150 },
      { source: 'youth', target: 'salaries', value: 300 },
      { source: 'youth', target: 'travel', value: 100 },
      { source: 'youth', target: 'facilities', value: 300 },
      { source: 'operations', target: 'salaries', value: 350 },
      { source: 'operations', target: 'facilities', value: 550 },
      { source: 'sponsoring', target: 'youth', value: 0 },
    ],
  },
  traffic: {
    label: 'Website visits by channel, page and outcome',
    nodes: [...TRAFFIC_CHANNELS, ...TRAFFIC_PAGES, ...TRAFFIC_OUTCOMES].map((label) => ({ id: label, label })),
    links: trafficLinks(),
  },
};

@Component({
  selector: 'et-sb-sankey-chart',
  template: `
    <div
      [etProvideSurface]="surface()"
      class="text-medium flex flex-col gap-4 p-8 font-sans"
      style="background: var(--et-surface-background-solid); color: var(--et-surface-color-solid)"
    >
      <p class="text-small m-0 opacity-60">{{ story().label }}</p>
      <div [style.inline-size]="boxWidth()">
        <et-sankey-chart
          [nodes]="story().nodes"
          [links]="story().links"
          [label]="story().label"
          [height]="height()"
          [nodeGap]="nodeGap()"
          [labelWidth]="labelWidth()"
          [colorToken]="colorToken() || null"
        />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [SankeyChartComponent, ProvideSurfaceDirective],
})
export class SankeyChartStorybookComponent {
  public surface = input('light');
  public dataset = input<SankeyChartStoryDataset>('match-day');
  public width = input(720);
  public height = input(320);
  public nodeGap = input(12);
  public labelWidth = input(120);
  public colorToken = input('');

  protected story = computed(() => DATASETS[this.dataset()]);
  protected boxWidth = computed(() => `min(${this.width()}px, 100%)`);
}
