// Demo fixtures live here rather than in the component file. An interpolated template literal
// anywhere above an inline `template:` desynchronises the Angular VS Code extension's editor-side
// scanner, which then stops forwarding template completions to the language service - see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

import { PaginationLabels } from '../pagination-labels';

// A full German label set - an app would normally provide this once via `providePaginationLabels`.
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
