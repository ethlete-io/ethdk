import { PaginationLabels } from '@ethlete/components';

export const GERMAN_LABELS: Partial<PaginationLabels> = {
  navigation: 'Seitennavigation',
  first: 'Erste Seite',
  previous: 'Vorherige Seite',
  next: 'Nächste Seite',
  last: 'Letzte Seite',
  ellipsis: 'Weitere Seiten',
  page: (page) => `Seite ${page}`,
  range: ({ start, end, totalItems }) => `Zeige ${start}–${end} von ${totalItems}`,
  compactRange: ({ start, end, totalItems }) => `${start}–${end} von ${totalItems}`,
  jumpTo: 'Gehe zu Seite',
  pageSize: 'Einträge pro Seite',
};
