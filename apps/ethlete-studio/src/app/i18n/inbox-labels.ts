export const INBOX_LABELS = {
  open: (count: number) => `${count} offen`,
  showResolved: 'Erledigte zeigen',
  loading: 'Kommentare werden geladen…',
  errorTitle: 'Kommentare nicht geladen',
  errorText: 'Die Liste kam nicht vom Design-Server an.',
  interrupted: 'Verbindung unterbrochen. Die Liste ist evtl. nicht aktuell.',
  retry: 'Erneut laden',
  emptyTitle: 'Keine offenen Kommentare',
  emptyText: 'Kommentare von dir, deinem Agenten und dem Team erscheinen hier.',
  noneOnPart: (part: string) => `Keine offenen Kommentare zu ${part}.`,
  others: 'Andere',
} as const;
