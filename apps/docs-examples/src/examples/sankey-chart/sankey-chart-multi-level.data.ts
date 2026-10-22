import { SankeyChartLinkInput, SankeyChartNodeInput } from '@ethlete/components';

export const BUDGET_NODES: SankeyChartNodeInput[] = [
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
];

export const BUDGET_LINKS: SankeyChartLinkInput[] = [
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
];
