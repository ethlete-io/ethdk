import { banner, bannerStyles } from '@ethlete/components/design/banner';
import { html } from '@design-system';
import anchoredDialog from '@system/components/anchored-dialog';
import button from '@system/components/button';
import { icon } from '@system/foundations/icons';

export const ONE_STALE = ['button.ts'];
export const MANY_STALE = ['button.ts', 'menu.ts', 'tooltip.ts', 'select.ts'];

const COMMAND = 'NX_NO_CLOUD=true npx nx build components';
const HEADING = 'Design-Mocks veraltet';

const description = (mocks: string[]) =>
  `Die Zeichnungen nutzen alte Mocks (${mocks.join(', ')}). Baue sie neu: <code class="font-mono">${COMMAND}</code>`;

export const staleBanner = (mocks: string[], cls = '') => ({
  body: html`<div class="${cls}" data-et-semantic-color="warning">
    ${banner({ type: 'warning', heading: HEADING, description: description(mocks) })}
  </div>`,
  styles: bannerStyles,
});

export const staleChip = async (mocks: string[]) => {
  const drawn = await button.render({
    label: 'Mocks veraltet',
    icon: `<span class="contents" data-et-semantic-color="warning">${icon('warning', { size: 14, cls: 'text-et-theme' })}</span>`,
    variant: 'outline',
    size: 'sm',
    pressed: true,
  });
  const dialog = await anchoredDialog.render({
    label: HEADING,
    modal: false,
    content: html`<div class="w-96 text-ui-sm">
      <header class="px-space-3 pt-space-3 pb-space-2 border-b border-(--et-surface-border-solid)">
        <span class="text-(--et-surface-color-solid) font-ui-strong">${HEADING}</span>
      </header>
      <p class="m-0 px-space-3 py-space-3 text-(--et-surface-color-muted-solid)">${description(mocks)}</p>
    </div>`,
  });

  return {
    body: html`<div class="relative">
      ${drawn.body}
      <div
        class="absolute top-full right-0 mt-2.5 [&_.et-overlay-arrow]:left-0"
        style="--et-floating-arrow-translate: translate3d(300px, 0, 0); transform: translate3d(0, 0, 0)"
      >
        ${dialog.body}
      </div>
    </div>`,
    styles: drawn.styles + dialog.styles,
  };
};
