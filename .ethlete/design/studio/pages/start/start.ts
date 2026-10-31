import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import { studioMark } from '@system/foundations/logo';

type Props = { repo?: string };

const open = await button.render({ label: 'Repo öffnen', variant: 'filled' });
const copy = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });
const other = await button.render({ label: 'Anderes Repo', variant: 'transparent', size: 'sm' });

const header = (repo?: string) =>
  html`<header class="flex items-center gap-space-3 p-space-4">
    ${studioMark(24)}
    <span class="text-(--et-surface-color-solid) font-ui-strong text-ui-md">Ethlete Studio</span>
    ${repo ? html`<span class="text-(--et-surface-color-muted-solid) text-ui-sm">${repo}</span>${other.body}` : ''}
  </header>`;

const ghostFolder = html`<span
  class="block w-24 h-16 rounded-sm outline outline-(--et-surface-border-solid) et-surface--dark bg-(--et-surface-background-solid)"
  aria-hidden="true"
></span>`;

const ghostProduct =
  '<span class="block w-10 h-10 rounded-full outline outline-(--et-surface-border-solid) et-surface--dark bg-(--et-surface-background-solid)"></span>';

const card = (inner: string) =>
  html`<div class="flex-1 flex items-center justify-center">
    <div class="w-2xl flex flex-col items-center gap-space-4 text-center text-ui-sm">${inner}</div>
  </div>`;

const noRepo = card(
  html`${ghostFolder}
    <p class="m-0 text-(--et-surface-color-solid) font-ui-strong text-ui-md">Kein Repo geöffnet</p>
    <p class="m-0 text-(--et-surface-color-muted-solid)">
      Studio liest das Design-System aus einem Git-Checkout. Öffne den Ordner eines Repos, in dem die Produkte liegen
      oder entstehen sollen.
    </p>
    ${open.body}`,
);

const noProducts = (repo: string) =>
  card(
    html`<div class="flex items-center gap-space-2" aria-hidden="true">
        ${ghostProduct}${ghostProduct}${ghostProduct}
      </div>
      <p class="m-0 text-(--et-surface-color-solid) font-ui-strong text-ui-md">Noch keine Produkte</p>
      <p class="m-0 text-(--et-surface-color-muted-solid)">
        Ein Produkt ist ein eigenes Design-System, zum Beispiel für eine App, mit Teilen, Sketches und Flows. Dein Agent
        legt es an. Bitte ihn zum Beispiel so:
      </p>
      <p
        class="m-0 p-space-3 rounded-(--radius-control-md) et-surface--dark bg-(--et-surface-background-solid) text-(--et-surface-color-solid) text-ui-sm"
      >
        Lege in ${repo} das Produkt shop an, für das Design-System der Shop-App.
      </p>
      ${copy.body}
      <p class="m-0 text-(--et-surface-color-muted-solid)">
        Oder im Terminal: <code>et design product new shop</code>
      </p>`,
  );

export default definePart<Props>({
  note: 'The start page before a product exists, without the shell: the section bubbles mean nothing without a product. Only the mark and a centred card in the same shape as the empty Flows and System pages. Without a repo the card asks to open a checkout; with a repo but no products it gives an example prompt for the agent, a copy button and the real CLI command.',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states: { 'no-repo': {}, 'no-products': { repo: 'ethlete-sdk' } },
  render: ({ repo }) =>
    drawing({
      body: html`<div class="h-full min-h-225 flex flex-col et-surface--dark bg-(--et-surface-background-solid)">
        ${header(repo)} ${repo ? noProducts(repo) : noRepo}
      </div>`,
      styles: open.styles + copy.styles + other.styles,
    }),
});
