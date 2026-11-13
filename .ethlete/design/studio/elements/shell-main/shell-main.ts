import { definePart, html } from '@design-system';
import { shellCollapse } from '@system/components/shell-collapse';
import { shellSystemPicker, shellSystemPickerMenu } from '@system/components/shell-system-picker';
import { studioMarkLine } from '@system/foundations/logo';
import { shellMain, type SystemChoice, type SystemForce } from './shared/shell-main';
import styles from './shell-main.css?inline';

const systemTrigger = (product: string, open: boolean, force?: SystemForce) => {
  const interaction =
    !open && force && !force.startsWith('option') ? (force as 'hover' | 'active' | 'focus-visible') : undefined;

  return shellSystemPicker({ product, open, interaction }, { open: 'system-picker', closed: 'closed' });
};

const systemChoice: SystemChoice = async ({ product, products, open, force }) => {
  const option = force === 'option-hover' ? 'hover' : force === 'option-focus-visible' ? 'focus-visible' : undefined;
  const panel = open ? await shellSystemPickerMenu({ product, products, option }, force === 'focus-visible') : null;

  return {
    head: html`${systemTrigger(product, open, force)}${shellCollapse()}`,
    top: '',
    surface: panel
      ? html`<div class="st-system-picker absolute box-border w-58" data-et-surface="system.open">${panel.body}</div>`
      : '',
    styles: panel?.styles ?? '',
  };
};

const resizeLine =
  '<span class="st-shell-resize-line absolute top-2.5 bottom-2.5 left-0.75 w-0.5 rounded-full group-hover:bg-et-theme/50 group-active:bg-et-theme group-focus-visible:bg-focus-ring"></span>';
const shell = shellMain(styles, resizeLine, systemChoice, {
  states: {
    'system.hover': { systemForce: 'hover' },
    'system.active': { systemForce: 'active' },
    'system-picker': { systemPicker: 'open' },
    'system-picker-focus-visible': { systemPicker: 'open', systemForce: 'focus-visible' },
    'system-picker.option-hover': { systemPicker: 'open', systemForce: 'option-hover' },
    'system-picker.option-focus-visible': { systemPicker: 'open', systemForce: 'option-focus-visible' },
  },
  control: {
    kind: 'select' as const,
    part: 'components/shell-system-picker' as const,
    surfaces: { open: 'system-picker' as const },
  },
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
  note: 'The window title bar (components/title-bar) runs over the full window width, above rail and content, and names the product. The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Its standalone preview fills that slot with the neutral Studio mark; pages supply the complete menu element and its styles and setup. Menu states live on elements/studio-menu. Its layout states are panel open and panel hidden, and the design server stopped and starting screens fill the content area with the server log and a restart button; the rail sections are System, Flows and Inbox (no Sketches item: an open sketch sits in the explorer and marks System), and the rail section and product buttons draw the shell hover fill, pressed fill and inset focus ring on --transition-state. The right edge of the panel is a resize handle (role separator, col-resize cursor, arrow keys): 248 px by default, 200 to 400 px; states resize with its hover, active (dragging at 312 px, col-resize over the whole shell) and focus-visible, resize-min and resize-max. At rest the handle draws nothing beyond the panel border; hover draws a 2-px accent line at half opacity, dragging the full accent line, focus-visible the line in --focus-ring. The panel head is the design-system choice: components/shell-system-picker opens an SDK menu of the design systems below it (system-picker); the collapse button stays at its right. The project switch and Projekt öffnen… live in elements/studio-menu; the panel has no foot. The collapse button is components/shell-collapse.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6', 'design check'],
  controls: shell.controls,
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-main/shell-main.component.ts',
  render: (props: Parameters<typeof shell.render>[0]) =>
    shell.render({ ...props, studio: props.studio ?? studioPreview }),
});
