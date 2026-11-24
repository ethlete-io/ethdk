export const CANVAS_LABELS = {
  label: 'Design Canvas',
  loading: 'Lädt',
  live: 'Live · Esc',
  loadFailed: 'Laden fehlgeschlagen.',
  unanswered: 'Der Design-Server antwortet nicht.',
  reload: 'Neu laden',
  renderFailed: 'Zeichnen fehlgeschlagen',
  rendering: 'Wird gerendert',
  notDrawn: 'nicht gezeichnet',
  restOnly: 'Nur Ruhezustand',
  noFrameMessage: 'Die Seite hat keine Frame-Nachricht gesendet.',
  loadedWithoutFrameMessage: 'Die Seite wurde geladen, hat aber keine Frame-Nachricht gesendet.',
  serverAnswered: (status: number, statusText: string) =>
    `Der Design-Server antwortete ${status} ${statusText}`.trim() + '.',
} as const;

export const ZOOM_LABELS = {
  out: 'Verkleinern',
  reset: 'Auf 100 % zoomen',
  in: 'Vergrößern',
  fit: 'Einpassen',
  fitButton: 'Fit',
  resetTooltip: 'Auf 100 % zoomen (Shift+0)',
  fitTooltip: 'Einpassen (Shift+1)',
} as const;
