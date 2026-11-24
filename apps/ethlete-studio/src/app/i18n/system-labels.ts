export const TREE_ROW_LABELS = {
  sketchReady: 'Entwurf fertig',
  sketchNeedsRebase: (parts: readonly string[]) =>
    parts.length === 0 ? 'Braucht Rebase: keine Baseline' : `Braucht Rebase: ${parts.join(', ')} geändert`,
  sketchRebaseUncommitted: (commit: string) => `Rebase nach ${commit} nicht committet`,
  sketchChangedSinceReady: (variants: readonly string[]) => `Seit Freigabe geändert: ${variants.join(', ')}`,
  sketchHoldTargetEnded: (target: string, end: 'merged' | 'discarded') =>
    `Pausiert auf ${target}, das ${end === 'merged' ? 'übernommen' : 'verworfen'} ist: Pause aufheben`,
  warnings: {
    'changed since ready': 'Der Entwurf wurde nach der Freigabe geändert. Prüfe ihn erneut und gib ihn wieder frei.',
    'hold target ended': 'Der Entwurf wartet auf einen Entwurf, der schon abgeschlossen ist. Hebe die Pause auf.',
  },
  openComments: (count: number) => (count === 1 ? '1 offener Kommentar' : `${count} offene Kommentare`),
} as const;

export const SYSTEM_LABELS = {
  none: 'Noch keine Teile.',
  serverDown: 'Design-Server läuft nicht',
  readFailed: 'Lesefehler',
  foldedStates: (count: number) =>
    count === 1 ? '1 weiterer Zustand eingeklappt' : `${count} weitere Zustände eingeklappt`,
  showAllStates: 'Alle Zustände zeigen',
  listingFailed: 'Auflistung fehlgeschlagen',
  reload: 'Erneut laden',
  emptyTitle: 'Noch keine Teile',
  emptyExplainer:
    'Das Design-System eines Produkts wächst in Schichten: Foundations, Components, Elements und Pages. Dein Agent zeichnet jeden Teil als Sketch, du wählst unter Sketches. Bitte ihn zum Beispiel so:',
  emptyPrompt: (product: string) => `Lege die Foundations für ${product} an: Farben, Schrift und Abstände.`,
  copyPrompt: 'Prompt kopieren',
  statesByInteraction: 'Zustände nach Interaktion',
  openCount: (count: number) => `${count} offen`,
  nothingOpen: 'Nichts offen',
  shotsMissing: (count: number) => (count === 1 ? '1 Bild fehlt' : `${count} Bilder fehlen`),
  openPoints: 'Offene Punkte',
  more: (count: number) => `+${count} weitere`,
  allDone: 'Jeder Zustand ist gezeichnet, verknüpft und besprochen.',
  noControls: 'Keine Controls deklariert',
  controlUndrawn: (control: string) => `${control} hat keinen gezeichneten Zustand`,
  dataStateUndrawn: (state: 'loading' | 'error' | 'empty') =>
    `Daten-Part ohne Zustand ${{ loading: 'Laden', error: 'Fehler', empty: 'Leer' }[state]}`,
  builtPlaceholder: 'Bild der App als Platzhalter - im Sketch neu zeichnen',
  commentAnswered: 'Beantwortet, wartet auf dich',
  sketchPicked: 'Sketch gewählt, noch nicht gemergt',
  sketchOpen: 'Sketch noch nicht gemergt',
  embeddedNotReady: (part: string) => `${part} ist noch nicht baubereit`,
  directEdit: 'Bild ohne Sketch geändert',
  comment: 'Kommentar',
  commentOn: (frame: string) => `Kommentar zu ${frame}`,
  commentModeOr: 'oder',
  commentModeEnds: 'beendet',
  frameGrid: 'grid',
  frameTree: 'tree',
} as const;

export const BUILD_READY_LABELS = {
  ready: 'Baubereit',
  checking: 'Wird geprüft',
  developer: 'Entwickler-Part',
  blocked: (count: number) => (count > 0 ? `Nicht baubereit (${count})` : 'Nicht baubereit'),
  reasons: 'Gründe',
  openEditSketch: 'Sketch öffnen',
  groups: {
    'direct-edit': 'Direkte Änderung',
    'open-point': 'Offene Punkte',
    embedded: 'Eingebettete Teile',
    problem: 'Regeln',
    compare: 'Vergleich mit der App',
    'sdk-error': 'SDK-Fehler',
    'stale-record': 'Prüfstand',
  },
} as const;

export const SYSTEM_TREE_LABELS = {
  notUsed: 'Nicht verwendet',
  composition: 'nur zusammengesteckt, eher eine Seite',
  product: 'Produkt',
  appCode: 'App-Code',
  notUsedIn: (name: string) => `Nicht verwendet in ${name}`,
  legacy: 'Legacy',
  foundations: 'Foundations',
  elements: 'Elements',
  components: 'Components',
  pages: 'Pages',
  wireframes: 'Wireframes',
  sketches: 'Sketches',
  rejected: 'abgelehnt',
  withdrawn: 'Zurückgezogen',
  drawing: 'wird gezeichnet …',
  variantBy: (variant: string, authors: string) => `${variant} von ${authors}`,
  newInSketch: (state: string | undefined, has: string[]) =>
    state === undefined || has.length === 0
      ? 'neu in diesem Sketch'
      : `${state} ist neu in diesem Sketch. Aktuell gibt es: ${has.join(', ')}`,
  noState: (column: string, state: string | undefined) => `${column} hat keinen Zustand ${state}`,
  noInteraction: (column: string, interaction: string) => `${column} hat keine Interaktion ${interaction}`,
  now: 'jetzt',
  afterMerging: (variant: string) => `nach dem Merge von ${variant}`,
  reasonBy: (by: string) => `, Grund von ${by}`,
  rejectedWith: (reason: string) => `Abgelehnt: ${reason}`,
  rejectedLabel: 'Abgelehnt',
  withdrawnWith: (reason: string) => `Zurückgezogen: ${reason}`,
  withdrawnLabel: 'Zurückgezogen',
  rejectedBy: (by: string, reasonBy: string) => `von ${by}${reasonBy}`,
} as const;
