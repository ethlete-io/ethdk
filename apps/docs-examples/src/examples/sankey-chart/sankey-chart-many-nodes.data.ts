import { SankeyChartLinkInput, SankeyChartNodeInput } from '@ethlete/components';

const CHANNELS = ['Search', 'Social', 'Newsletter', 'Partners', 'Direct', 'Ads'];
const PAGES = ['Fixtures', 'Tickets', 'News', 'Shop', 'Club TV', 'Academy'];
const OUTCOMES = ['Ticket bought', 'Shop order', 'Sign-up', 'Video watched', 'Left'];

export const TRAFFIC_NODES: SankeyChartNodeInput[] = [...CHANNELS, ...PAGES, ...OUTCOMES].map((label) => ({
  id: label,
  label,
}));

const trafficLinks = (): SankeyChartLinkInput[] => {
  const links: SankeyChartLinkInput[] = [];

  CHANNELS.forEach((channel, c) => {
    PAGES.forEach((page, p) => {
      const value = ((c * 7 + p * 5) % 9) * 40 + (c === p ? 600 : 0);

      if (value) links.push({ source: channel, target: page, value });
    });
  });

  PAGES.forEach((page, p) => {
    const inflow = links.filter((link) => link.target === page).reduce((sum, link) => sum + link.value, 0);
    const shares = OUTCOMES.map((_, o) => (o === p % OUTCOMES.length ? 4 : ((p + o) % 3) + 1));
    const total = shares.reduce((sum, share) => sum + share, 0);

    OUTCOMES.forEach((outcome, o) => {
      links.push({ source: page, target: outcome, value: Math.round((inflow * (shares[o] ?? 0)) / total) });
    });
  });

  return links;
};

export const TRAFFIC_LINKS = trafficLinks();
