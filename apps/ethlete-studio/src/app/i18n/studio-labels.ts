export const STUDIO_LABELS = {
  treeRow: {
    sketchInProgress: 'Entwurf in Arbeit',
    sketchReady: 'Entwurf fertig',
    openComments: (count: number) => (count === 1 ? '1 offener Kommentar' : `${count} offene Kommentare`),
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
} as const;
