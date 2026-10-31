import pickerStyles from '@shared/picker.css?inline';
import { drawing, forceInteraction, html, interactionRows } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { icon, type IconName } from '@system/foundations/icons';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

type ShellControl = 'collapse' | 'project' | 'option' | 'action';

type ShellTarget = ShellControl | 'selected';

type ShellInteraction = 'hover' | 'active' | 'focus-visible';

type Props = {
  section: Section;
  product: string;
  side: string;
  content: string;
  panel?: 'hidden';
  projectPicker?: 'open';
  studio?: string;
  target?: ShellTarget;
  interaction?: ShellInteraction;
};

const forced = (markup: string, control: ShellTarget, { target, interaction }: Props) =>
  interaction && target === control ? forceInteraction(markup, interaction) : markup;

const controlled = (markup: string, attributes: string) =>
  markup.replace(/^<button /, `<button ${attributes} data-can-animate `);

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const RECENT_PRODUCTS = ['studio', 'timetrack', 'docs'];

const ICONS: Record<Section, IconName> = {
  System: 'grid',
  Sketches: 'pencil',
  Flows: 'flow',
  Inbox: 'inbox',
};

type SlotKind = 'section' | 'product' | 'all';

const bubbleClass = (kind: SlotKind, active: boolean, panelHidden: boolean) => {
  if (kind === 'section') {
    return `rounded-control-lg ${active ? 'text-accent-text' : 'text-text-muted'}${active && !panelHidden ? ' bg-accent-subtle' : ''}`;
  }

  if (kind === 'product') {
    return `rounded-control-md ${active ? 'bg-surface-overlay text-text' : 'bg-surface-raised text-text-muted'}`;
  }

  return 'rounded-control-md text-text-muted';
};

const slot = (inner: string, label: string, active: boolean, kind: SlotKind, panelHidden = false) =>
  `<div class="st-shell-slot relative flex justify-center w-full${active ? ` before:absolute before:left-0 ${kind === 'section' ? 'before:bg-accent' : 'before:bg-text'}` : ''}" data-kind="${kind}"${active ? ' data-active' : ''}><span class="st-shell-bubble flex items-center justify-center text-ui-sm font-ui-strong ${bubbleClass(kind, active, panelHidden)}" title="${label}">${inner}</span></div>`;

const sep = '<div class="st-shell-sep my-space-2 bg-surface-border"></div>';

const rail = (section: Section, product: string, panelHidden: boolean, studio: string) =>
  html`<nav class="st-shell-rail flex flex-col items-center gap-space-1 py-space-3 bg-surface">
    <div class="st-shell-slot relative flex justify-center w-full min-h-10" data-kind="logo">${studio}</div>
    ${sep} ${SECTIONS.map((s) => slot(icon(ICONS[s], { size: 20 }), s, s === section, 'section', panelHidden)).join('')}
    <div class="flex-1"></div>
    ${sep} ${RECENT_PRODUCTS.map((p) => slot(p.charAt(0).toUpperCase(), p, p === product, 'product')).join('')}
    ${slot(icon('more', { size: 18 }), 'All products', false, 'all')}
  </nav>`;

const projectSwitch = (open: boolean, props: Props) =>
  forced(
    html`<button
      class="st-shell-project flex items-center gap-space-2 w-full h-control-md py-0 px-space-2 rounded-control-md bg-surface-raised text-text-muted text-left cursor-pointer hover:bg-surface-overlay aria-expanded:bg-surface-overlay"
      type="button"
      data-et-control="project"
      aria-haspopup="listbox"
      aria-expanded="${open}"
    >
      <span
        class="st-shell-project-badge flex flex-none items-center justify-center rounded-control-sm bg-surface-overlay text-text text-ui-xs font-ui-strong"
        >E</span
      >
      <span class="flex-1 min-w-0 overflow-hidden text-text text-ellipsis whitespace-nowrap">ethlete-sdk</span>
      ${icon('up-down', { size: 16 })}
    </button>`,
    'project',
    props,
  );

const collapseButton = (props: Props) =>
  forced(
    html`<button
      class="st-shell-collapse flex items-center justify-center size-control-sm p-0 rounded-control-md bg-surface-raised text-text cursor-pointer hover:bg-surface-overlay"
      type="button"
      data-et-control="collapse"
      title="Hide panel"
      aria-label="Hide panel"
    >
      ${icon('panel', { size: 18 })}
    </button>`,
    'collapse',
    props,
  );

const sidePanel = (props: Props) =>
  html`<aside
    class="st-shell-side absolute top-space-3 bottom-space-3 left-space-3 flex flex-col min-h-0 overflow-hidden rounded-control-lg bg-surface"
  >
    <header class="st-shell-side-head flex items-center justify-between box-border pr-space-2 pl-space-4">
      <span class="text-ui-lg font-ui-strong">${props.product}</span>
      ${collapseButton(props)}
    </header>
    <div class="flex-1 min-h-0 overflow-hidden p-space-2">${props.side}</div>
    <footer class="st-shell-side-foot p-space-2">${projectSwitch(props.projectPicker === 'open', props)}</footer>
  </aside>`;

const pickerRow = (name: string, selected: boolean, props: Props, key?: ShellTarget) => {
  const row = `<div class="st-project-option flex items-center min-h-control-md py-0 px-space-2 rounded-control-md cursor-pointer${selected ? ' bg-accent-subtle text-accent-text hover:bg-accent/20' : ' hover:bg-surface-raised'}" role="option" tabindex="-1" data-et-control="option" aria-selected="${selected}">${name}</div>`;

  return key ? forced(row, key, props) : row;
};

const picker = (placement: 'above' | 'beside', props: Props) =>
  html`<div
    class="st-project-picker absolute box-border w-62 border border-surface-border p-space-1 rounded-control-lg bg-surface-overlay${placement === 'above' ? ' left-space-3' : ' bottom-space-3'}"
    data-placement="${placement}"
    data-et-surface="project.open"
  >
    <div role="listbox" aria-label="Projekt auswählen">
      ${pickerRow('ethlete-sdk', true, props, 'selected')} ${pickerRow('fut-frontend', false, props, 'option')}
      ${pickerRow('design-playground', false, props)}
    </div>
    <div class="st-project-picker-action mt-space-1 border-t border-surface-border pt-space-1 rounded-none">
      ${forced(
        controlled(
          button({
            label: 'Projekt öffnen…',
            variant: 'transparent',
            size: 'sm',
            class: 'h-control-md justify-start py-0 px-space-2',
          }),
          'data-et-control="action"',
        ),
        'action',
        props,
      )}
    </div>
  </div>`;

const BASE: Props = { section: 'System', product: 'studio', side: '', content: '' };

const PICKER: Props = { ...BASE, projectPicker: 'open' };

const rows = interactionRows<Props, ShellTarget, ShellInteraction>(
  {
    collapse: { ...BASE, target: 'collapse' },
    project: { ...BASE, target: 'project' },
    option: { ...PICKER, target: 'option' },
    selected: { ...PICKER, target: 'selected' },
    action: { ...PICKER, target: 'action' },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

const INPUT = ['pointer' as const, 'keyboard' as const];

const BUTTON = { kind: 'button' as const, input: INPUT };

export const shellMain = (placement: 'above' | 'beside', styles: string) => ({
  widths: [1440],
  states: {
    'project-picker': { ...BASE, projectPicker: 'open' },
    open: BASE,
    hidden: { ...BASE, panel: 'hidden' },
    ...rows.states,
  } satisfies Record<string, Props>,
  grid: rows.grid,
  controls: {
    collapse: BUTTON,
    project: { kind: 'select' as const, input: INPUT, surfaces: { open: 'project-picker' as const } },
    option: { kind: 'row' as const, input: INPUT },
    action: BUTTON,
  },
  render: (props: Props) => {
    const { product, section, panel, projectPicker, studio = '' } = props;
    return drawing({
      body: html`<div
        class="st-shell relative grid overflow-hidden bg-surface text-text font-ui text-ui-md"
        data-floating${panel === 'hidden' ? ' data-panel="hidden"' : ''}
      >
        ${rail(section, product, panel === 'hidden', studio)}
        <div class="st-shell-stage relative min-w-0">
          <main class="st-shell-content absolute inset-0 min-w-0 overflow-hidden bg-surface">${props.content}</main>
          ${panel === 'hidden' ? '' : sidePanel(props)}
          ${panel !== 'hidden' && projectPicker === 'open' ? picker(placement, props) : ''}
        </div>
      </div>`,
      styles: styles + pickerStyles + buttonStyles,
    });
  },
});
