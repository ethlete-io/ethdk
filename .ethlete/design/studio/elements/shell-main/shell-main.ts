import { definePart, html } from '@design-system';
import { shellCollapse } from '@system/components/shell-collapse';
import { shellResizeHandle, shellResizeHandleStyles } from '@system/components/shell-resize-handle';
import { shellSystemPicker, shellSystemPickerMenu } from '@system/components/shell-system-picker';
import { studioMarkLine } from '@system/foundations/logo';
import { restartButton, shellMain, type CrashScreen, type SystemChoice, type SystemForce } from './shared/shell-main';
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

const crashScreen: CrashScreen = ({ time, pid, port, path, stack }) =>
  html`<div
    class="mx-auto mt-15 flex w-full max-w-6xl box-border flex-col items-start gap-space-3 px-space-5 text-ui-sm text-et-surface-muted"
    role="alert"
  >
    <div class="flex flex-col gap-space-1">
      <h3 class="m-0 text-ui-lg font-ui-strong text-et-surface">Design-Server abgestürzt</h3>
      <p class="m-0">Abgestürzt am ${time} (PID ${pid}, Port ${port})</p>
    </div>
    <pre
      class="m-0 box-border max-h-60 w-full overflow-auto rounded-control-md bg-et-surface-interaction/6 p-space-3 font-code text-ui-xs whitespace-pre-wrap"
    >
${stack.join('\n')}</pre>
    <p class="m-0">Ganzes Log: <span class="font-code break-all text-et-surface">${path}</span></p>
    ${restartButton}
  </div>`;

const shell = shellMain(
  styles + shellResizeHandleStyles,
  shellResizeHandle,
  systemChoice,
  {
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
  },
  crashScreen,
);
const studioPreview = html`<span
  class="inline-flex size-10 items-center justify-center rounded-control-lg bg-et-surface-bg text-et-surface"
  data-et-auto-surface
  aria-label="Studio"
>
  ${studioMarkLine(28.8)}
</span>`;

export default definePart({
  ...shell,
  note: 'The window title bar (components/title-bar) runs over the full window width, above rail and content, and names the product. The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Its standalone preview fills that slot with the neutral Studio mark; pages supply the complete menu element and its styles and setup. Menu states live on elements/studio-menu. Its layout states are panel open and panel hidden, and the design server stopped and crashed screens fill the content area with the server log and a restart button, and the starting screen, which a restart click switches to at once, is aria-busy with the SDK spinner beside its heading; the rail sections are System, Flows and Inbox (no Sketches item: an open sketch sits in the explorer and marks System), and the rail section and product buttons draw the shell hover fill, pressed fill and inset focus ring on --transition-state. The right edge of the panel is components/shell-resize-handle: 248 px by default, 200 to 400 px; states resize with its hover, active (dragging at 312 px, col-resize over the whole shell) and focus-visible, resize-min and resize-max. The panel head is the design-system choice: components/shell-system-picker opens an SDK menu of the design systems below it (system-picker); the collapse button stays at its right. The project switch and Projekt öffnen… live in elements/studio-menu; the panel has no foot. The collapse button is components/shell-collapse.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6', 'design check'],
  describe: {
    'server-stopped':
      'The stopped design server; check the Design-Server gestoppt heading, the log block and the restart button in the content area.',
    'server-starting':
      'The server starting after a restart; check the SDK spinner beside the heading and that the area is marked busy.',
    'server-unanswered':
      'A server that does not answer at localhost:4402; check the heading, the address and the restart button.',
    'server-crashed':
      'A crashed server; check Design-Server abgestürzt with time, PID and port, the stack block, the log path and the restart button.',
    open: 'The shell with the title bar, the rail and the open panel at 248px; check the System section marked and the picker and collapse in the panel head.',
    'open-focus-visible':
      'The design-system picker focused by keyboard; check its focus ring in the panel head, not clipped by the panel edge.',
    hidden: 'The shell with the panel hidden; check that the content reaches the rail and the rail keeps its sections.',
    section: 'The rail section buttons at rest; check System, Flows and Inbox with System marked as the open one.',
    'section-hover': 'Flows hovered in the rail; check the shell hover fill on Flows only.',
    'section-active': 'Flows pressed in the rail; check the pressed fill on Flows only.',
    'section-focus-visible': 'Flows focused by keyboard; check the inset focus ring on Flows, not clipped by the rail.',
    product: 'The rail product buttons at rest; check that the open product is marked and the others are quiet.',
    'product-hover': 'timetrack hovered in the rail; check the shell hover fill on timetrack only.',
    'product-active': 'timetrack pressed in the rail; check the pressed fill on timetrack only.',
    'product-focus-visible':
      'timetrack focused by keyboard; check the inset focus ring on timetrack, not clipped by the rail.',
    resize: 'The panel at 248px with its resize handle at rest; check that the panel edge shows no line.',
    'resize-hover': 'The resize handle hovered; check the half-opacity accent line on the panel edge.',
    'resize-active':
      'The panel dragged to 312px; check the full accent line and that the content follows the wider panel.',
    'resize-focus-visible': 'The resize handle focused by keyboard; check the line in the focus-ring colour.',
    'resize-min':
      'The panel at its 200px minimum; check that the picker name and the tree truncate instead of overflowing.',
    'resize-max': 'The panel at its 400px maximum; check that the content area shrinks and nothing overlaps.',
    'system.hover':
      'The design-system picker hovered; check the hover fill behind studio and its chevron in the panel head.',
    'system.active': 'The design-system picker pressed; check the press fill in the panel head.',
    'system-picker':
      'The design-system menu open under the picker; check studio checked and that the menu overlays the panel, not the rail.',
    'system-picker-focus-visible':
      'The menu opened by keyboard; check the keyboard highlight on studio inside the menu.',
    'system-picker.option-hover':
      'timetrack hovered in the open menu; check that only it is highlighted and studio keeps its check mark.',
    'system-picker.option-focus-visible':
      "timetrack focused by keyboard in the open menu; check its keyboard highlight and studio's check mark.",
  },
  controls: shell.controls,
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-main/shell-main.component.ts',
  render: (props: Parameters<typeof shell.render>[0]) =>
    shell.render({ ...props, studio: props.studio ?? studioPreview }),
});
