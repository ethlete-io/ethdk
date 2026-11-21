import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import { studioMark } from '@system/foundations/logo';
import { STUDIO_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/studio-labels';

type Props = { repo?: string; busy?: boolean };

const header = (other: string, repo?: string) =>
  html`<header class="flex items-center gap-space-3 p-space-4">
    ${studioMark(24)}
    <span class="text-et-surface font-ui-strong text-ui-md">${STUDIO_LABELS.start.title}</span>
    ${repo ? html`<span class="text-et-surface-muted text-ui-sm">${repo}</span>${withAction(other, 'emit:otherRepo')}` : ''}
  </header>`;

const ghostProduct =
  '<span class="block w-10 h-10 rounded-full outline outline-et-surface-border bg-et-surface-bg"></span>';

const card = (inner: string) =>
  html`<div class="flex-1 flex items-center justify-center">
    <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">${inner}</div>
  </div>`;

const noRepo = (open: string) =>
  card(
    html`<p class="m-0 text-et-surface font-ui-strong text-ui-md">${STUDIO_LABELS.start.noRepo}</p>
      <p class="m-0 text-et-surface-muted">
        Studio liest das Design-System aus einem Git-Checkout. Öffne den Ordner eines Repos, in dem die Produkte liegen
        oder entstehen sollen.
      </p>
      ${withAction(open, 'emit:openRepo')}`,
  );

const noProducts = (copy: string, repo: string) =>
  card(
    html`<div class="flex items-center gap-space-2" aria-hidden="true">
        ${ghostProduct}${ghostProduct}${ghostProduct}
      </div>
      <p class="m-0 text-et-surface font-ui-strong text-ui-md">${STUDIO_LABELS.start.noProducts}</p>
      <p class="m-0 text-et-surface-muted">
        Ein Produkt ist ein eigenes Design-System, zum Beispiel für eine App, mit Teilen, Sketches und Flows. Dein Agent
        legt es an. Bitte ihn zum Beispiel so:
      </p>
      <p class="m-0 p-space-3 rounded-(--radius-control-md) bg-et-surface-bg text-et-surface text-ui-sm">
        Lege in ${repo} das Produkt shop an, für das Design-System der Shop-App.
      </p>
      ${withAction(copy, 'emit:copyPrompt')}
      <p class="m-0 text-et-surface-muted">
        ${STUDIO_LABELS.start.orTerminal} <code class="font-code">${STUDIO_LABELS.start.command}</code>
      </p>`,
  );

export default definePart<Props>({
  note: 'The start page before a product exists, without the shell: the section bubbles mean nothing without a product. Only the mark and a centred card in the same shape as the empty Flows and System pages. Without a repo the card asks to open a checkout; with a repo but no products it gives an example prompt for the agent, a copy button and the real CLI command. While a picked folder is being added, Repo öffnen and Anderes Repo are the SDK busy button (loading: busy): the spinner covers the label, the button is disabled and aria-busy and takes no second click; that state belongs to components/button (ADR 0331).',
  madeBy: ['claude-opus-5-5'],
  implements: { route: '/', component: 'apps/ethlete-studio/src/app/design-parts/start/start.component.ts' },
  widths: [1440],
  states: {
    'no-repo': {},
    'no-products': { repo: 'ethlete-sdk' },
  },
  describe: {
    'no-repo':
      'The start page without a repo; check the mark, the centred Kein Repo geöffnet card and the filled Repo öffnen button, without the shell.',
    'no-products':
      'A repo without products; check the repo name in the header, Noch keine Produkte with the et design product new shop prompt and Prompt kopieren.',
  },
  render: async ({ repo, busy }) => {
    const open = await button.render({ label: STUDIO_LABELS.start.openRepo, variant: 'filled', loading: busy });
    const copy = await button.render({ label: STUDIO_LABELS.start.copyPrompt, variant: 'outline', size: 'sm' });
    const other = await button.render({
      label: STUDIO_LABELS.start.otherRepo,
      variant: 'transparent',
      size: 'sm',
      loading: busy,
    });

    return drawing({
      body: html`<div class="h-full min-h-225 flex flex-col bg-et-surface-bg">
        ${header(other.body, repo)} ${repo ? noProducts(copy.body, repo) : noRepo(open.body)}
      </div>`,
      styles: open.styles + copy.styles + other.styles,
    });
  },
});
