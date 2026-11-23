const spanOf = (minutes: number) => {
  if (minutes < 60) return `${minutes} Min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} Std`;

  const days = Math.floor(minutes / 1440);

  return days === 1 ? '1 Tag' : `${days} Tagen`;
};

export const SKETCHES_LABELS = {
  none: 'Noch keine Skizzen.',
  emptyTitle: 'Keine offenen Skizzen',
  emptyText: 'Skizzen deines Agenten erscheinen hier, sobald er einen Entwurf zeichnet.',
  loading: 'Lädt',
  discard: 'Verwerfen',
  editHint: 'Kein Verwerfen: wähle eine der beiden Zeilen',
  editOld: 'Zuletzt gemergter Stand',
  editNew: 'Änderung behalten',
  discardConfirm: {
    label: 'Skizze verwerfen',
    question: (part: string) => `Skizze ${part} verwerfen?`,
    note: 'Alle Varianten der Skizze gehen verloren.',
    confirm: 'Verwerfen',
  },
  mergeConfirm: {
    label: 'Variante übernehmen',
    question: (variant: string, part: string) => `${variant} in ${part} übernehmen?`,
    note: 'Die übrigen Varianten der Skizze gehen verloren.',
    confirm: 'Übernehmen',
  },
  confirm: { cancel: 'Abbrechen' },
  merge: 'Übernehmen',
  mergeHold: ({ reason, dirty }: { reason: string; dirty?: string[] }) =>
    dirty?.length
      ? `Automatischer Merge wartet auf ungespeicherte Änderungen in ${dirty.join(', ')} - committen oder verwerfen, dann läuft er von selbst.`
      : `Nicht automatisch gemerged: ${reason}`,
  variant: (label: string) => `Variante ${label}`,
  withdrawnToggle: (count: number) => `Zurückgezogene (${count})`,
  fitHint: 'Doppelklick zum Einpassen',
  current: 'Aktuell',
  modelTitle: (id: string, when?: string) => [id, when].filter(Boolean).join(' · '),
  unchanged: 'unverändert',
  stateSeparator: ' · ',
  comparing: 'vergleicht …',
  compareFailed: (message: string) => `Vergleich fehlgeschlagen: ${message}`,
  reload: 'Erneut laden',
  sameVariants: (names: string[]) => `Unverändert: ${names.map((name) => name.replace(/ /g, '\u00A0')).join(', ')}`,
  firstChange: 'erste Änderung',
  changedCell: 'geändert',
  foldedStates: (count: number) =>
    count === 1 ? '1 unveränderter Zustand eingeklappt' : `${count} unveränderte Zustände eingeklappt`,
  pendingStates: (count: number) => (count === 1 ? 'vergleicht 1 Zustand …' : `vergleicht ${count} Zustände …`),
  pendingFailed: (count: number) =>
    count === 1 ? 'Vergleich von 1 Zustand fehlgeschlagen' : `Vergleich von ${count} Zuständen fehlgeschlagen`,
  newInSketch: 'neu in der Skizze',
  missingInVariant: 'fehlt in dieser Variante',
  showAllStates: 'Alle Zustände zeigen',
  wholeScreen: 'Ganzer Screen',
  cropScreen: 'Ausschnitt',
  sameCrop: (count: number) => `${count} Zustände, gleicher Ausschnitt`,
  changeReason: (pixels: number, regions: number) =>
    `${pixels} px in ${regions} ${regions === 1 ? 'Stelle' : 'Stellen'}`,
  variantReason: (variant: string, reason: string) => `${variant}: ${reason}`,
  magnified: (factor: string) => ` · ${factor}× vergrößert`,
  drawingMark: 'zeichnet',
  drawingVariant: 'zeichnet diese Variante',
  drawingHint: 'Der Rahmen füllt sich, sobald die erste Ansicht steht.',
  addedSkip: 'Neuer Skip',
  addedSkipIn: (part: string) => `in ${part} - stellt eine Prüfung stumm`,
  mergePort: (merged: readonly string[]) => `Agent portiert nach Merge von ${merged.join(', ')}`,
  fresh: 'neu',
  autoMerge: 'Übernimmt sich selbst',
  status: {
    drawing: 'zeichnet',
    waiting: 'Wartet auf deine Wahl',
    picked: 'Variante gewählt',
    paused: 'Pausiert',
    idle: 'Keine Aktivität',
    notReady: 'Noch nicht bereit',
    failed: 'Render fehlgeschlagen',
  },
  notReadyUnknown: 'Grund unbekannt - der Agent hat den Sketch noch nicht geprüft',
  holdUntil: (until: string) => `Wartet auf ${until}`,
  lastChange: (by: string, since: string) =>
    by || since ? [by ? `Letzte Änderung von ${by}` : 'Letzte Änderung', since].filter(Boolean).join(' · ') : '',
  since: (minutes: number) => `seit ${spanOf(minutes)}`,
  agentRun: {
    failed: (round: number | null) => (round === null ? 'Runde fehlgeschlagen' : `Runde ${round} fehlgeschlagen`),
    errored: (variants: readonly string[]) =>
      `Render-Fehler in ${variants.length === 1 ? 'Variante' : 'Varianten'} ${variants.join(', ')}`,
    errors: (lines: readonly string[]) => (lines.length > 1 ? `${lines[0]} (+${lines.length - 1})` : (lines[0] ?? '')),
    ago: (minutes: number) => `vor ${spanOf(minutes)}`,
  },
  roundSelect: 'Runde',
  round: (number: number, title: string) => [`Runde ${number}`, title].filter(Boolean).join(' · '),
} as const;

export const MERGE_LABELS = {
  needsRebase: (parts: readonly string[]) =>
    parts.length === 0
      ? 'Der Sketch hat keine Baseline. Lass deinen Agent den Sketch rebasen.'
      : `${parts.join(', ')} hat sich seit dem Sketch geändert. Lass deinen Agent den Sketch rebasen.`,
} as const;
