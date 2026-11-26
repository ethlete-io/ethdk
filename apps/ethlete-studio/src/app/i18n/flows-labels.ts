export const FLOW_FRAMES_LABELS = {
  group: 'Flows',
  noPart: (key: string) => `kein Teil ${key}`,
  noState: (key: string, state: string) => `${key} hat keinen Zustand „${state}“`,
} as const;

export const FLOWS_LABELS = {
  none: 'Noch keine Flows.',
  emptyTitle: 'Noch keine Flows',
  emptyExplainer:
    'Ein Flow verbindet Seiten und ihre Zustände zu einem Weg, den du von links nach rechts liest. Dein Agent legt ihn an. Bitte ihn zum Beispiel so:',
  emptyPrompt: 'Zeichne den Flow „Sketch prüfen“: von der Inbox über den Sketch bis zum gemergten Teil.',
  copyPrompt: 'Prompt kopieren',
  presetAria: 'Bildschirmgröße',
  addNote: 'Notiz',
  note: 'Notiz',
  notePlaceholder: 'Notiz schreiben',
  deleteNote: 'Notiz löschen',
  orphans: 'Verwaiste Notizen',
  noOrphans: 'Keine',
  otherSize: (count: number) =>
    count === 1 ? '1 Kommentar bei anderer Größe' : `${count} Kommentare bei anderer Größe`,
  presetLabel: (name: string, { width, height }: { width: number; height?: number }) =>
    height === undefined ? `${name} · ${width}` : `${name} · ${width} × ${height}`,
  sample: {
    names: ['Sketch prüfen', 'Kommentar beantworten', 'Produkt anlegen'],
    lines: ["Nutzer klickt 'Sketches' in der Leiste", "Nutzer klickt 'Erledigte zeigen'", "Nutzer klickt 'Merge'"],
    preset: 'Desktop · 1440 × 900',
    pinText: 'Der Merge-Knopf ist hier zu leise.',
    notes: ['Hier fehlt noch der Weg, wenn der Nutzer den Sketch verwirft.'],
    orphans: ['Rückweg nach Verwerfen', 'Merge-Knopf klären'],
  },
} as const;
