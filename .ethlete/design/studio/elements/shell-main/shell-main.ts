import { definePart, html } from '@design-system';
import { studioMarkLine } from '@system/foundations/logo';
import { shellMain } from './shared/shell-main';
import styles from './shell-main.css?inline';

const shell = shellMain('above', styles);
const studioPreview = html`<span
  class="inline-flex size-10 items-center justify-center rounded-control-lg bg-surface-raised text-text"
  aria-label="Studio"
>
  ${studioMarkLine(28.8)}
</span>`;

export default definePart({
  ...shell,
  note: 'The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Its standalone preview fills that slot with the neutral Studio mark; pages supply the complete menu element and its styles and setup. Menu states live on elements/studio-menu. Its states are layout only: panel open, panel hidden, project picker open. The panel controls and their interaction states are their own parts: components/shell-collapse, components/shell-project-switch (the picker is its surface) and components/shell-project-option.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6'],
  render: (props: Parameters<typeof shell.render>[0]) =>
    shell.render({ ...props, studio: props.studio ?? studioPreview }),
});
