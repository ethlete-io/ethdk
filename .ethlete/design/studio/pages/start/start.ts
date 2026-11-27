import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import { icon } from '@system/foundations/icons';
import { studioMark } from '@system/foundations/logo';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';
import { START_LABELS, StartBase, StartColors } from '../../../../../apps/ethlete-studio/src/app/i18n/start-labels';

type Props = {
  repo?: string;
  repos?: string[];
  busy?: boolean;
  colors?: StartColors;
  accent?: string;
  base?: StartBase;
};

const TRAY =
  'rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border)) bg-et-surface-background shadow-(--et-anchored-panel-shadow,0_10px_24px_color-mix(in_srgb,var(--et-shadow-color,rgb(0_0_0))_16%,transparent))';

const COLORS: StartColors[] = ['light', 'dark', 'both'];

const BASES: StartBase[] = ['sdk', 'own'];

const TRAY_CLASS = 'flex items-center gap-space-2 p-space-1 font-ui';

const header = (repo?: string) =>
  html`<header class="flex items-center gap-space-3 p-space-4">
    ${studioMark(24)}
    <span class="text-et-surface-text font-ui-strong text-ui-md">${START_LABELS.title}</span>
    ${repo ? html`<span class="text-et-surface-text-muted text-ui-sm">${repo}</span>` : ''}
  </header>`;

const toolbar = (other: string) =>
  html`<div class="absolute inset-x-0 bottom-space-3 z-3 flex justify-center">
    <div class="${TRAY_CLASS} ${TRAY}" role="toolbar" aria-label="${SKETCHES_LABELS.toolbar}" data-sk-toolbar>
      ${withAction(other, 'emit:otherRepo')}
    </div>
  </div>`;

const ghostProduct =
  '<span class="block w-10 h-10 rounded-full outline outline-et-surface-border bg-et-surface-background"></span>';

const card = (inner: string) =>
  html`<div class="flex-1 flex items-center justify-center">
    <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">${inner}</div>
  </div>`;

const knownRepos = (buttons: string[]) =>
  buttons.length
    ? html`<p class="m-0 text-et-surface-text-muted text-ui-sm">${START_LABELS.knownRepos}</p>
        <div class="flex flex-wrap justify-center gap-space-2">${buttons.join('')}</div>`
    : '';

const noRepo = (open: string, known: string[]) =>
  card(
    html`<p class="m-0 text-et-surface-text font-ui-strong text-ui-md">${START_LABELS.noRepo}</p>
      <p class="m-0 text-et-surface-text-muted">
        Studio liest das Design-System aus einem Git-Checkout. Öffne den Ordner eines Repos, in dem die Produkte liegen
        oder entstehen sollen.
      </p>
      ${withAction(open, 'emit:openRepo')} ${knownRepos(known)}`,
  );

const question = (title: string, buttons: string[]) =>
  html`<div class="flex flex-col items-center gap-space-2">
    <p class="m-0 text-et-surface-text font-ui-strong text-ui-sm">${title}</p>
    <div class="flex flex-wrap justify-center gap-space-2" role="group" aria-label="${title}">${buttons.join('')}</div>
  </div>`;

const noProducts = (copy: string, repo: string, known: string[], questions: string, prompt: string) =>
  card(
    html`<div class="flex items-center gap-space-2" aria-hidden="true">
        ${ghostProduct}${ghostProduct}${ghostProduct}
      </div>
      <p class="m-0 text-et-surface-text font-ui-strong text-ui-md">${START_LABELS.noProducts}</p>
      <p class="m-0 text-et-surface-text-muted">
        Ein Produkt ist ein eigenes Design-System, zum Beispiel für eine App, mit Teilen, Sketches und Flows. Dein Agent
        legt es an. Bitte ihn zum Beispiel so:
      </p>
      ${questions}
      <p class="m-0 p-space-3 rounded-(--radius-control-md) bg-et-surface-background text-et-surface-text text-ui-sm">
        ${prompt}
      </p>
      ${withAction(copy, 'emit:copyPrompt')} ${knownRepos(known)}`,
  );

export default definePart<Props>({
  note: 'The start page before a product exists, without the shell: the section bubbles mean nothing without a product. Only the mark and a centred card in the same shape as the empty Flows and System pages. Without a repo the card asks to open a checkout; with a repo but no products it asks for the colour base (Hell, Dunkel or Beides, Beides by default) and the accent (five named swatches, Rot by default) as outline toggle buttons, then whether the product inherits from the Ethlete SDK (Erbt vom SDK or Eigenständig, none pressed by default: without an answer the prompt says nothing about a base), and gives an example prompt for the agent that carries the answers, and a copy button; Studio text names no CLI command. With a repo open, Anderes Repo is a folder icon button with a tooltip in the shared toolbar at the bottom centre (the header has no button). While a picked folder is being added, Repo öffnen and Anderes Repo is the SDK busy icon button (loading: busy): the spinner covers the label, the button is disabled and aria-busy and takes no second click; that state belongs to components/button, for example while farn opens. When Studio knows other repos, both cards list them under Zuletzt geöffnet as small outline buttons that switch without a folder dialog, for example farn.',
  madeBy: ['claude-opus-5-5', 'design check', 'claude-sonnet-5-5'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/start/start.component.ts' },
  widths: [1440],
  states: {
    'no-repo': {},
    'no-products': { repo: 'ethlete-sdk' },
    'no-repo-known': { repos: ['ethlete-sdk', 'tomflix'] },
    'no-products-known': { repo: 'tomflix', repos: ['ethlete-sdk', 'tomflix', 'fifagg-frontend'] },
    'no-products-dark': { repo: 'tomflix', colors: 'dark', accent: 'Rot' },
    'no-products-sdk': { repo: 'tomflix', colors: 'dark', accent: 'Rot', base: 'sdk' },
  },
  describe: {
    'no-repo':
      'The start page without a repo; check the mark, the centred Kein Repo geöffnet card and the filled Repo öffnen button, without the shell.',
    'no-products':
      'A repo without products; check the repo name in the header, Noch keine Produkte with the et design product new shop prompt and Prompt kopieren.',
    'no-repo-known':
      'No repo open but two known: check the Zuletzt geöffnet label and one small outline button per repo below Repo öffnen.',
    'no-products-known':
      'A repo without products and two other known repos: check the Zuletzt geöffnet row below Prompt kopieren, without the current repo.',
    'no-products-dark':
      'Tomflix answered Dunkel and Rot: check that only those two toggles are pressed and the prompt asks for a dunkler Farb-Grundlage with Akzent Rot.',
    'no-products-sdk':
      'Tomflix also answered Erbt vom SDK: check that Dunkel, Rot and Erbt vom SDK are pressed and the prompt ends with Es erbt vom Ethlete SDK (@ethlete/components).',
  },
  render: async ({ repo, repos = [], busy, colors = 'both', accent: accentName, base }) => {
    const accent = START_LABELS.accents.find((item) => item.name === accentName) ?? START_LABELS.accents[0];
    const schemeButtons = await Promise.all(
      COLORS.map((scheme) =>
        button.render({
          label: START_LABELS.colors[scheme],
          variant: 'outline',
          size: 'sm',
          pressed: scheme === colors,
        }),
      ),
    );
    const accentButtons = await Promise.all(
      START_LABELS.accents.map((item) =>
        button.render({
          label: item.name,
          icon: `<span class="block size-3 rounded-full" style="background: ${item.hex}"></span>`,
          variant: 'outline',
          size: 'sm',
          pressed: item === accent,
        }),
      ),
    );
    const baseButtons = await Promise.all(
      BASES.map((item) =>
        button.render({
          label: START_LABELS.bases[item],
          variant: 'outline',
          size: 'sm',
          pressed: item === base,
        }),
      ),
    );
    const questions =
      question(
        START_LABELS.colorsQuestion,
        schemeButtons.map((rendered) => rendered.body),
      ) +
      question(
        START_LABELS.accentQuestion,
        accentButtons.map((rendered) => rendered.body),
      ) +
      question(
        START_LABELS.baseQuestion,
        baseButtons.map((rendered) => rendered.body),
      );

    const open = await button.render({ label: START_LABELS.openRepo, variant: 'filled', loading: busy });
    const copy = await button.render({ label: START_LABELS.copyPrompt, variant: 'outline', size: 'sm' });
    const other = await button.render({
      iconOnly: true,
      icon: icon('folder', { size: 16 }),
      ariaLabel: START_LABELS.otherRepo,
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
      loading: busy,
    });

    const known = await Promise.all(
      repos
        .filter((name) => name !== repo)
        .map(async (name) =>
          withAction(
            (await button.render({ label: name, variant: 'outline', size: 'sm', disabled: busy })).body,
            'emit:projectChange',
          ),
        ),
    );

    return drawing({
      body: html`<div class="relative h-full min-h-225 flex flex-col bg-et-surface-background">
        ${header(repo)}
        ${
          repo
            ? noProducts(copy.body, repo, known, questions, START_LABELS.prompt({ repo, colors, accent, base }))
            : noRepo(open.body, known)
        }
        ${repo ? toolbar(other.body) : ''}
      </div>`,
      styles: open.styles + copy.styles + other.styles + (schemeButtons[0]?.styles ?? ''),
    });
  },
});
