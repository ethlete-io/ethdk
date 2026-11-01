import { definePart, html } from '@design-system';
import { studioMarkLine } from '@system/foundations/logo';
import { shellMain } from './shared/shell-main';
import styles from './shell-main.css?inline';

const shell = shellMain('above', styles);
const studioPreview = html`<span
  class="inline-flex size-10 items-center justify-center rounded-control-lg bg-et-surface-bg text-et-surface"
  data-et-auto-surface
  aria-label="Studio"
>
  ${studioMarkLine(28.8)}
</span>`;

export default definePart({
  ...shell,
  note: 'The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Its standalone preview fills that slot with the neutral Studio mark; pages supply the complete menu element and its styles and setup. Menu states live on elements/studio-menu. Its layout states are panel open, panel hidden and project picker open, and the design server stopped and starting screens fill the content area with the server log and a restart button; the rail section, product and all-products buttons draw the shell hover fill, pressed fill and inset focus ring on --transition-state. The panel controls and their interaction states are their own parts: components/shell-collapse and components/shell-project-switch (the picker is its surface).',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6'],
  controls: shell.controls,
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-main/shell-main.component.ts',
  render: (props: Parameters<typeof shell.render>[0]) =>
    shell.render({ ...props, studio: props.studio ?? studioPreview }),
});
