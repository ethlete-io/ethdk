export const DESIGN_SERVER_LABELS = {
  start: 'Design-Server starten',
  restart: 'Design-Server neu starten',
  stop: 'Design-Server stoppen',
  stopped: 'Design-Server gestoppt',
  starting: 'Design-Server startet',
  startPhase: {
    starting: 'Design-Server startet',
    'cli-build': 'CLI wird gebaut',
    'app-build': 'Oberfläche wird gebaut',
  },
  startElapsed: (ms: number) => {
    const seconds = Math.floor(ms / 1000);

    return seconds < 60
      ? `seit ${seconds} s`
      : `seit ${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
  },
  unanswered: (url: string) => `Design-Server antwortet nicht: ${url}`,
  restartButton: 'Neu starten',
  crashed: 'Design-Server abgestürzt',
  crashedAt: ({ time, pid, port }: { time: string; pid: number; port: number }) =>
    `Abgestürzt am ${time} (PID ${pid}, Port ${port})`,
  crashLog: 'Ganzes Log:',
} as const;

export const STUDIO_MENU_LABELS = {
  trigger: 'Studio-Menü',
  panel: 'Studio',
  project: 'Projekt',
  openProject: 'Projekt öffnen…',
  scan: 'Checkouts suchen…',
  inventory: 'Inventory',
  designServer: 'Design-Server',
  reload: 'Neu laden',
  serverStatus: { running: 'läuft', stale: 'veraltet', stopped: 'gestoppt' },
  shortcuts: 'Tastenkürzel',
  help: 'Hilfe',
  about: 'Über Studio',
} as const;

export const ABOUT_DIALOG_LABELS = {
  title: 'Über Studio',
  close: 'Schließen',
  product: 'Ethlete Studio',
  version: (version: string) => `Version ${version}`,
  license: 'MIT-Lizenz, © 2025 The Authors',
} as const;

export const SHORTCUTS_DIALOG_LABELS = {
  title: 'Tastenkürzel',
  close: 'Schließen',
  general: 'Allgemein',
  canvas: 'Canvas',
  palette: 'Suche und Befehle',
  shortcuts: 'Tastenkürzel',
  fitAll: 'Alle Frames zeigen',
  fitFocused: 'Gewählten Frame zeigen',
  actualSize: 'Auf 100 % zoomen',
  pan: 'Verschieben beim Ziehen',
  deselect: 'Auswahl aufheben',
} as const;

export const CODE_LABELS = {
  host: 'Host geändert - Studio neu starten',
  cli: 'CLI geändert - neu starten',
  cliDirty: (sha: string) => `CLI hat uncommittete Änderungen, Studio läuft auf Stand ${sha}`,
  frontend: 'Oberfläche geändert - neu starten',
  restart: 'Neu starten',
  restartFailedTitle: 'Neustart fehlgeschlagen',
  restartFailedMessage: 'Der Design-Server antwortet nicht. Das Log steht im Studio-Menü.',
  push: ({ unpushed, age }: { unpushed: number; age: string }) => `${unpushed} ungepusht · ${age}`,
  pushAge: (hours: string) => `${hours} h`,
  uncommitted: (count: number) => `${count} offen`,
  uncommittedKinds: {
    'READY UNCOMMITTED': 'Ready-Marke',
    'SKETCH UNTRACKED': 'Sketch ungetrackt',
    'SKETCH LEFTOVER': 'Sketch übrig',
  } as Record<string, string>,
} as const;

export const SCAN_CHECKOUTS_LABELS = {
  found: (count: number) => (count === 1 ? '1 Checkout gefunden' : `${count} Checkouts gefunden`),
  none: 'Keine neuen Checkouts gefunden',
  failedTitle: 'Checkouts nicht durchsucht',
} as const;

export const OPEN_FOLDER_LABELS = {
  refusedTitle: 'Ordner nicht geöffnet',
  refusedMessage: 'In diesem Ordner liegt keine Design-Arbeit.',
} as const;

export const TITLE_BAR_LABELS = {
  search: (product: string, part: string) => `Suchen in ${[product, part].filter(Boolean).join(', ')}`,
  update: 'Update',
  window: {
    minimize: 'Minimieren',
    maximize: 'Maximieren',
    restore: 'Wiederherstellen',
    close: 'Schließen',
  },
} as const;

export const COMMAND_PALETTE_LABELS = {
  label: 'Befehlsrahmen',
  placeholder: 'Parts, Seiten, Skizzen und Befehle suchen',
  recent: 'Zuletzt geöffnet',
  groups: { part: 'Parts', page: 'Seiten', sketch: 'Skizzen', command: 'Befehle' },
  hints: { part: 'Part', page: 'Seite', sketch: 'Skizze', command: 'Befehl' },
  none: 'Nichts gefunden',
  noneFor: (query: string) => `Für „${query}“ gibt es keinen Part, keine Seite und keine Skizze.`,
  start: 'Noch nichts zuletzt geöffnet. Tippe einen Namen oder Befehl.',
  startShortcut: 'öffnet die Suche von überall.',
  select: '↑↓ wählen',
  open: '↵ öffnen',
  close: 'Esc schließen',
} as const;

export const UPDATE_DIALOG_LABELS = {
  label: 'Update installieren',
  question: (version: string) => `Update auf v${version} installieren?`,
  note: 'Studio startet dafür neu.',
  later: 'Später',
  restart: 'Neu starten',
} as const;

export const SHELL_LABELS = {
  designSystem: 'Design-System',
  preset: 'Voreinstellung',
  startServer: 'Starte den Design-Server, um das Design-System zu sehen.',
  noParts: 'Dieses Produkt hat noch keine Teile.',
  transferred: 'übertragen',
  markTransferred: 'Als übertragen markieren',
  surfaceTheme: 'Oberflächen-Theme',
  colorTheme: 'Farb-Theme',
  sideWidth: 'Breite der Seitenleiste',
  studio: 'Studio',
  hidePanel: 'Panel ausblenden',
} as const;

export const EXCEPTIONS_LABELS = {
  toggle: 'Ausnahmen',
  reopened: 'wieder offen',
  pending: 'offen',
  approve: 'Freigeben',
} as const;
