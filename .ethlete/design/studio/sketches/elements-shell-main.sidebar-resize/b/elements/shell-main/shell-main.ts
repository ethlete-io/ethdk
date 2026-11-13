import { definePart, html } from '@design-system';
import { studioMarkLine } from '@system/foundations/logo';
import { shellMain } from '@shared/shell-main';
import styles from './shell-main.css?inline';

const resizeLine =
  '<span class="st-shell-resize-line absolute top-1/2 left-0.5 h-7 w-1 -translate-y-1/2 rounded-full bg-et-surface-muted/50 group-hover:bg-et-theme group-active:top-2.5 group-active:bottom-2.5 group-active:left-0.75 group-active:h-auto group-active:w-0.5 group-active:translate-y-0 group-focus-visible:outline-[1.5px] group-focus-visible:outline-offset-1 group-focus-visible:outline-focus-ring"></span>';
const shell = shellMain('above', styles, resizeLine);
const studioPreview = html`<span
  class="inline-flex size-10 items-center justify-center rounded-control-lg bg-et-surface-bg text-et-surface"
  data-et-auto-surface
  aria-label="Studio"
>
  ${studioMarkLine(28.8)}
</span>`;

export default definePart({
  ...shell,
  note: 'The window title bar (components/title-bar) runs over the full window width, above rail and content, and names the product. The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Its standalone preview fills that slot with the neutral Studio mark; pages supply the complete menu element and its styles and setup. Menu states live on elements/studio-menu. Its layout states are panel open, panel hidden and project picker open, and the design server stopped and starting screens fill the content area with the server log and a restart button; the rail section and product buttons draw the shell hover fill, pressed fill and inset focus ring on --transition-state. The right edge of the panel is a resize handle (role separator, col-resize cursor, arrow keys): 248 px by default, 200 to 400 px; states resize with its hover, active (dragging at 312 px, col-resize over the whole shell) and focus-visible, resize-min and resize-max. At rest a 4 x 28 px grip sits mid-height on the edge; hover turns it accent, dragging stretches it into a 2-px accent line over the full edge, focus-visible rings it in --focus-ring. The panel controls and their interaction states are their own parts: components/shell-collapse and components/shell-project-switch (the picker is its surface).',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6', 'design check'],
  controls: shell.controls,
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-main/shell-main.component.ts',
  render: (props: Parameters<typeof shell.render>[0]) =>
    shell.render({ ...props, studio: props.studio ?? studioPreview }),
});
