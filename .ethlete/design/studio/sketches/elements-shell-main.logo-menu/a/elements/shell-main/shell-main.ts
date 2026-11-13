import { definePart, forceInteraction, html, withAction } from '@design-system';
import { button } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import menu from '@system/components/menu';
import { shellCollapse } from '@system/components/shell-collapse';
import { icon } from '@system/foundations/icons';
import { studioMarkLine } from '@system/foundations/logo';
import { shellMain, type SystemChoice, type SystemForce } from '@shared/shell-main';
import styles from './shell-main.css?inline';

const MENU_ITEM = 'data-et-slot="components/menu"';

const systemRows = (product: string, products: string[], force?: SystemForce): MenuMockRow[] => {
  const option = force === 'option-hover' ? 'hover' : force === 'option-focus-visible' ? 'focus-visible' : undefined;
  const keyboard = force === 'focus-visible';

  return [
    {
      kind: 'radio-group',
      label: 'Design-System',
      items: products.map((name, index) => {
        const current = name === product;
        const forced = index === 1 ? option : current && keyboard ? 'focus-visible' : undefined;

        return {
          kind: 'radio' as const,
          label: name,
          checked: current,
          active: !!forced || (current && !option),
          ...(forced === 'focus-visible' ? { activeSource: 'keyboard' as const } : {}),
          attributes: `${MENU_ITEM} data-et-action="${current ? 'closed' : 'emit:productChange'}"${forced ? ` data-et-force="${forced}"` : ''}`,
        };
      }),
    },
  ];
};

const systemTrigger = (product: string, open: boolean, force?: SystemForce) => {
  const markup = withAction(
    button({
      label: html`<span class="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-ui-lg font-ui-strong"
          >${product}</span
        >${icon('up-down', { size: 16 })}`,
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
      class: 'min-w-0 h-control-md justify-start gap-space-2 py-0 px-space-2 text-left',
    }).replace(
      /^<button /,
      `<button data-et-control="system" aria-haspopup="menu" aria-expanded="${open}" data-can-animate `,
    ),
    open ? 'closed' : 'system-picker',
  );
  const interaction =
    !open && force && !force.startsWith('option') ? (force as 'hover' | 'active' | 'focus-visible') : undefined;

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const systemChoice: SystemChoice = async ({ product, products, open, force }) => {
  const panel = open ? await menu.render({ rows: systemRows(product, products, force) }) : null;

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
    input: ['pointer' as const, 'keyboard' as const],
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
  note: 'The window title bar (components/title-bar) runs over the full window width, above rail and content, and names the product. The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Its standalone preview fills that slot with the neutral Studio mark; pages supply the complete menu element and its styles and setup. Menu states live on elements/studio-menu. Its layout states are panel open and panel hidden, and the design server stopped and starting screens fill the content area with the server log and a restart button; the rail section and product buttons draw the shell hover fill, pressed fill and inset focus ring on --transition-state. The right edge of the panel is a resize handle (role separator, col-resize cursor, arrow keys): 248 px by default, 200 to 400 px; states resize with its hover, active (dragging at 312 px, col-resize over the whole shell) and focus-visible, resize-min and resize-max. At rest the handle draws nothing beyond the panel border; hover draws a 2-px accent line at half opacity, dragging the full accent line, focus-visible the line in --focus-ring. The panel head is the design-system choice: an SDK transparent button with the product name and an up-down chevron opens an SDK menu of the design systems below it (system-picker), the open one checked; the collapse button stays at its right. The project switch and Projekt öffnen… live in elements/studio-menu; the panel has no foot. The collapse button is components/shell-collapse.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6', 'design check'],
  controls: shell.controls,
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-main/shell-main.component.ts',
  render: (props: Parameters<typeof shell.render>[0]) =>
    shell.render({ ...props, studio: props.studio ?? studioPreview }),
});
