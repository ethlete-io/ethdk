import { definePart, forceInteraction, html, withAction } from '@design-system';
import { button } from '@ethlete/components/design/button';
import { shellCollapse } from '@system/components/shell-collapse';
import { studioMarkLine } from '@system/foundations/logo';
import { shellMain, type SystemChoice, type SystemForce } from '@shared/shell-main';
import styles from './shell-main.css?inline';

const tabForce = (current: boolean, index: number, force?: SystemForce) => {
  if (force === 'focus-visible') return current ? force : undefined;
  if (force === 'selected-hover') return current ? 'hover' : undefined;

  return index === 1 ? force : undefined;
};

const systemButton = (name: string, current: boolean, forced?: string) => {
  const markup = withAction(
    button({
      label: name,
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
      pressed: current,
      class: 'min-w-0 px-space-2',
    }).replace(/^<button /, '<button data-et-control="system" data-can-animate '),
    current ? 'open' : 'emit:productChange',
  );

  return forced ? forceInteraction(markup, forced as 'hover' | 'active' | 'focus-visible') : markup;
};

const systemChoice: SystemChoice = async ({ product, products, force }) => ({
  head: html`<div class="flex flex-1 min-w-0 gap-space-1" role="group" aria-label="Design-System">
      ${products.map((name, index) => systemButton(name, name === product, tabForce(name === product, index, force))).join('')}
    </div>
    ${shellCollapse()}`,
  top: '',
  surface: '',
  styles: '',
});

const resizeLine =
  '<span class="st-shell-resize-line absolute top-2.5 bottom-2.5 left-0.75 w-0.5 rounded-full group-hover:bg-et-theme/50 group-active:bg-et-theme group-focus-visible:bg-focus-ring"></span>';
const shell = shellMain(styles, resizeLine, systemChoice, {
  states: {
    'system.hover': { systemForce: 'hover' },
    'system.active': { systemForce: 'active' },
    'system.selected-hover': { systemForce: 'selected-hover' },
  },
  control: { kind: 'row' as const, input: ['pointer' as const, 'keyboard' as const] },
});
const studioPreview = html`<span
  class="inline-flex size-10 items-center justify-center rounded-control-lg bg-et-surface-bg text-et-surface"
  data-et-auto-surface
  aria-label="Studio"
>
  ${studioMarkLine(28.8)}
</span>`;

export default definePart({
  ...shell,
  note: 'The window title bar (components/title-bar) runs over the full window width, above rail and content, and names the product. The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Its standalone preview fills that slot with the neutral Studio mark; pages supply the complete menu element and its styles and setup. Menu states live on elements/studio-menu. Its layout states are panel open and panel hidden, and the design server stopped and starting screens fill the content area with the server log and a restart button; the rail section and product buttons draw the shell hover fill, pressed fill and inset focus ring on --transition-state. The right edge of the panel is a resize handle (role separator, col-resize cursor, arrow keys): 248 px by default, 200 to 400 px; states resize with its hover, active (dragging at 312 px, col-resize over the whole shell) and focus-visible, resize-min and resize-max. At rest the handle draws nothing beyond the panel border; hover draws a 2-px accent line at half opacity, dragging the full accent line, focus-visible the line in --focus-ring. The panel head is the design-system choice: a segmented row of SDK transparent toggle buttons (sm) names the design systems, the open one pressed (tonal); the collapse button stays at its right. The project switch and Projekt öffnen… live in elements/studio-menu; the panel has no foot. The collapse button is components/shell-collapse.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6', 'design check'],
  controls: shell.controls,
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-main/shell-main.component.ts',
  render: (props: Parameters<typeof shell.render>[0]) =>
    shell.render({ ...props, studio: props.studio ?? studioPreview }),
});
