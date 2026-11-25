const spanOf = (minutes: number) => {
  if (minutes < 60) return `${minutes} Min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} Std`;

  const days = Math.floor(minutes / 1440);

  return days === 1 ? '1 Tag' : `${days} Tagen`;
};

const AUTO_MERGE = 'Automatisch';

export const SKETCHES_LABELS = {
  none: 'Noch keine Skizzen.',
  emptyTitle: 'Keine offenen Skizzen',
  emptyText: 'Skizzen deines Agenten erscheinen hier, sobald er einen Entwurf zeichnet.',
  loading: 'Lädt',
  discard: 'Verwerfen',
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
  repickConfirm: {
    label: 'Wahl ändern',
    question: (variant: string, part: string) => `${variant} in ${part} statt der bisherigen Wahl übernehmen?`,
    note: 'Die verworfenen Unterteil-Skizzen gehen verloren, auch freigegebene.',
    confirm: 'Wahl ändern',
    discards: 'Verwirft',
    keeps: 'Behält',
  },
  approveConfirm: {
    label: 'Variante freigeben',
    question: (variant: string, part: string) => `${variant} in ${part} freigeben?`,
    note: 'Sie wird mit der übergeordneten Skizze übernommen.',
    confirm: 'Freigeben',
  },
  confirm: { cancel: 'Abbrechen' },
  merge: 'Übernehmen',
  approve: 'Freigeben',
  variant: (label: string) => `Variante ${label}`,
  withdrawnToggle: (count: number) => `Zurückgezogene (${count})`,
  fitHint: 'Doppelklick zum Einpassen',
  current: 'Aktuell',
  unchanged: 'unverändert',
  fromSdk: 'vom SDK',
  stateSeparator: ' · ',
  sameAsRest: (states: readonly string[], base: string) => `${states.join(', ')} = ${base}`,
  stackedStates: (states: readonly string[]) => `+ ${states.join(', ')}`,
  comparing: 'vergleicht …',
  compareFailed: (message: string) => `Vergleich fehlgeschlagen: ${message}`,
  reload: 'Erneut laden',
  sameVariants: (names: string[]) => `Unverändert: ${names.map((name) => name.replace(/ /g, '\u00A0')).join(', ')}`,
  foldedStates: (count: number) =>
    count === 1 ? '1 unveränderter Zustand eingeklappt' : `${count} unveränderte Zustände eingeklappt`,
  openStates: (count: number) =>
    count === 1 ? '1 unveränderter Zustand ausgeklappt' : `${count} unveränderte Zustände ausgeklappt`,
  pendingStates: (count: number) => (count === 1 ? 'vergleicht 1 Zustand …' : `vergleicht ${count} Zustände …`),
  pendingFailed: (count: number) =>
    count === 1 ? 'Vergleich von 1 Zustand fehlgeschlagen' : `Vergleich von ${count} Zuständen fehlgeschlagen`,
  newInSketch: 'neu in der Skizze',
  foldedToRest: '= rest',
  missingInVariant: 'fehlt in dieser Variante',
  removedIn: (variant: string) => `entfällt in ${variant}`,
  removed: 'entfällt',
  showAllStates: 'Alle Zustände zeigen',
  hideStates: 'Zustände einklappen',
  wholeScreen: 'Ganzer Screen',
  cropScreen: 'Ausschnitt',
  sameCrop: (count: number) => `${count} Zustände, gleicher Ausschnitt`,
  changeReason: (pixels: number, regions: number) =>
    `${pixels} px in ${regions} ${regions === 1 ? 'Stelle' : 'Stellen'}`,
  variantReason: (variant: string, reason: string) => `${variant}: ${reason}`,
  magnified: (factor: string) => ` · ${factor}× vergrößert`,
  drawingMark: 'zeichnet',
  subParts: 'Unterteile',
  notRebuild: (of: string, difference: string) => `nicht ${of}: ${difference}`,
  drawingVariant: 'zeichnet diese Variante',
  drawingHint: 'Der Rahmen füllt sich, sobald die erste Ansicht steht.',
  mergePort: (merged: readonly string[]) => `Agent portiert nach Merge von ${merged.join(', ')}`,
  autoMerge: AUTO_MERGE,
  waitsOnSubSketches: (open: readonly string[]) => `Wartet auf Freigabe: ${open.join(', ')}`,
  status: {
    drawing: 'zeichnet',
    waiting: 'Wahl',
    awaitingApproval: 'Freigabe',
    awaitingSubParts: 'Unterteile',
    approved: 'Freigegeben',
    paused: 'Pausiert',
    failed: 'Fehler',
    merging: 'Übernahme',
    autoMerge: AUTO_MERGE,
  },
  holdUntil: (until: string) => `Wartet auf ${until}`,
  rowFailed: (reason: string) => `Render fehlgeschlagen: ${reason}`,
  since: (minutes: number) => `seit ${spanOf(minutes)}`,
  agentRun: {
    failed: (round: number | null) => (round === null ? 'Runde fehlgeschlagen' : `Runde ${round} fehlgeschlagen`),
    errors: (lines: readonly string[]) => (lines.length > 1 ? `${lines[0]} (+${lines.length - 1})` : (lines[0] ?? '')),
    ago: (minutes: number) => `vor ${spanOf(minutes)}`,
  },
  roundSelect: 'Runde',
  toolbar: 'Sketch',
  round: (number: number, title: string) => [`Runde ${number}`, title].filter(Boolean).join(' · '),
} as const;

export const MERGE_LABELS = {
  needsRebase: (parts: readonly string[]) =>
    parts.length === 0
      ? 'Der Sketch hat keine Baseline. Lass deinen Agent den Sketch rebasen.'
      : `${parts.join(', ')} hat sich seit dem Sketch geändert. Lass deinen Agent den Sketch rebasen.`,
} as const;
