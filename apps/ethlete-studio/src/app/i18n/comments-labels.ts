export const COMMENT_DRAFT_LABELS = {
  dialog: 'Kommentar schreiben',
  comment: 'Kommentar',
  placeholder: 'Enter sendet, Umschalt+Enter macht einen Zeilenumbruch',
  cancel: 'Abbrechen',
  send: 'Senden',
  sendAgain: 'Erneut senden',
  notSent: 'Kommentar nicht gesendet. Erneut versuchen.',
} as const;

export const COMMENT_THREAD_LABELS = {
  dialog: 'Kommentar-Faden',
  close: 'Faden schließen',
  resolve: 'Erledigen',
  withdraw: 'Zurückziehen',
  reply: 'Antwort',
  placeholder: 'Antworten…',
  send: 'Antworten',
  escCloses: 'schließt',
} as const;

export const COMMENT_LIST_LABELS = {
  title: 'Kommentare',
  open: (count: number) => `${count} offen`,
  unread: 'Ungelesen',
} as const;

export const COMMENT_PIN_LABELS = {
  label: ({ author, count, resolved }: { author: string; count: number; resolved: boolean }) =>
    `Comment by ${author}${count > 1 ? `, ${count} messages` : ''}${resolved ? ', resolved' : ''}`,
} as const;
