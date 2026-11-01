export const STUDIO_LABELS = {
  sketches: {
    discard: 'Verwerfen',
    merge: 'Merge',
    variant: (label: string) => `Variante ${label}`,
    fitHint: 'Doppelklick zum Einpassen',
  },
  treeRow: {
    sketchInProgress: 'Entwurf in Arbeit',
    sketchReady: 'Entwurf fertig',
    openComments: (count: number) => (count === 1 ? '1 offener Kommentar' : `${count} offene Kommentare`),
  },
  flows: {
    none: 'Noch keine Flows.',
    emptyTitle: 'Noch keine Flows',
    emptyExplainer:
      'Ein Flow verbindet Seiten und ihre Zustände zu einem Weg, den du von links nach rechts liest. Dein Agent legt ihn an. Bitte ihn zum Beispiel so:',
    emptyPrompt: 'Zeichne den Flow „Sketch prüfen“: von der Inbox über den Sketch bis zum gemergten Teil.',
    copyPrompt: 'Prompt kopieren',
  },
  inventory: {
    toggle: 'Inventory',
    title: 'Inventory',
    reload: 'Reload',
    approve: 'Approve inventory',
    notApproved: 'Not approved yet',
    approvedBy: 'Approved by designer on 31.10.2026, 14:20:00',
    drawing: 'Drawing the inventory…',
    frame: 'flow · desktop · dark',
  },
  start: {
    title: 'Ethlete Studio',
    otherRepo: 'Anderes Repo',
    noRepo: 'Kein Repo geöffnet',
    repoExplainer:
      'Studio liest das Design-System aus einem Git-Checkout. Öffne den Ordner eines Repos, in dem die Produkte liegen oder entstehen sollen.',
    openRepo: 'Repo öffnen',
    noProducts: 'Noch keine Produkte',
    productExplainer:
      'Ein Produkt ist ein eigenes Design-System, zum Beispiel für eine App, mit Teilen, Sketches und Flows. Dein Agent legt es an. Bitte ihn zum Beispiel so:',
    prompt: (repo: string) => `Lege in ${repo} das Produkt shop an, für das Design-System der Shop-App.`,
    copyPrompt: 'Prompt kopieren',
    orTerminal: 'Oder im Terminal:',
    command: 'et design product new shop',
  },
  merge: {
    back: 'Back to sketch',
    picked: 'Picked',
    changed: 'Changed',
    merge: 'Merge',
    usedIn: (name: string) => `Where ${name} is used`,
    now: 'Now',
    after: 'After merging',
    instances: (count: number) => (count === 1 ? '1 instance' : `${count} instances`),
    instance: (count: number) => `Instance 1 of ${count} · 200 %`,
    unchanged: (count: number, part: string) => `${count} states of ${part} without visible change`,
  },
} as const;
