export type StartColors = 'light' | 'dark' | 'both';

export type StartBase = 'sdk' | 'own';

export type StartAccent = { name: string; hex: string };

const PROMPT_BASE: Record<StartBase, string> = {
  sdk: ' Es erbt vom Ethlete SDK (@ethlete/components).',
  own: ' Es erbt nicht vom Ethlete SDK.',
};

const PROMPT_COLORS: Record<StartColors, string> = { light: 'heller', dark: 'dunkler', both: 'heller und dunkler' };

export const START_LABELS = {
  title: 'Ethlete Studio',
  otherRepo: 'Anderes Repo',
  noRepo: 'Kein Repo geöffnet',
  repoExplainer:
    'Studio liest das Design-System aus einem Git-Checkout. Öffne den Ordner eines Repos, in dem die Produkte liegen oder entstehen sollen.',
  openRepo: 'Repo öffnen',
  noProducts: 'Noch keine Produkte',
  productExplainer:
    'Ein Produkt ist ein eigenes Design-System, zum Beispiel für eine App, mit Teilen, Sketches und Flows. Dein Agent legt es an. Bitte ihn zum Beispiel so:',
  colorsQuestion: 'Farb-Grundlage',
  colors: { light: 'Hell', dark: 'Dunkel', both: 'Beides' },
  accentQuestion: 'Akzent',
  accents: [
    { name: 'Rot', hex: '#e50914' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Grün', hex: '#16a34a' },
    { name: 'Blau', hex: '#2563eb' },
    { name: 'Violett', hex: '#7c3aed' },
  ],
  baseQuestion: 'Ethlete SDK',
  bases: { sdk: 'Erbt vom SDK', own: 'Eigenständig' },
  prompt: ({
    repo,
    colors,
    accent,
    base,
  }: {
    repo: string;
    colors: StartColors;
    accent: StartAccent;
    base?: StartBase;
  }) =>
    `Lege in ${repo} das Produkt shop an, für das Design-System der Shop-App, mit ${PROMPT_COLORS[colors]} Farb-Grundlage und dem Akzent ${accent.name} (${accent.hex}).${base ? PROMPT_BASE[base] : ''}`,
  copyPrompt: 'Prompt kopieren',
  knownRepos: 'Zuletzt geöffnet',
} as const;
