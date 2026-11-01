import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import menu from '@system/components/menu';
import { icon } from '@system/foundations/icons';
import styles from './shell-project-switch.css?inline';

type SwitchInteraction = Exclude<Interaction, 'disabled'>;

type OptionInteraction = 'hover' | 'focus-visible';

type Props = { open?: boolean; interaction?: SwitchInteraction; option?: OptionInteraction | 'selected' };

const MENU_ITEM = 'data-et-slot="components/menu"';

const projectRows = (option?: Props['option']): MenuMockRow[] => {
  const forced = option && option !== 'selected' ? option : undefined;

  return [
    {
      kind: 'radio-group',
      items: [
        { kind: 'radio', label: 'ethlete-sdk', checked: true, active: !option, attributes: MENU_ITEM },
        {
          kind: 'radio',
          label: 'fut-frontend',
          active: !!forced,
          attributes: forced ? `${MENU_ITEM} data-et-force="${forced}"` : MENU_ITEM,
        },
        { kind: 'radio', label: 'design-playground', attributes: MENU_ITEM },
      ],
    },
    { kind: 'separator' },
    { label: 'Projekt öffnen…', attributes: MENU_ITEM },
  ];
};

export const shellProjectSwitchStyles = styles + buttonStyles;

export const shellProjectSwitch = ({ open = false, interaction }: Props = {}) => {
  const markup = button({
    label: html`<span
        class="st-shell-project-badge flex flex-none items-center justify-center rounded-control-sm bg-et-surface-bg text-et-surface text-ui-xs font-ui-strong"
        data-et-auto-surface
        >E</span
      ><span class="flex-1 min-w-0 overflow-hidden text-et-surface text-ellipsis whitespace-nowrap">ethlete-sdk</span
      >${icon('up-down', { size: 16 })}`,
    variant: 'transparent',
    color: 'surface',
    size: 'sm',
    class: 'w-full h-control-md justify-start gap-space-2 py-0 px-space-2 text-left [&>.et-button-contents]:flex-1',
  }).replace(
    /^<button /,
    `<button data-et-control="project" aria-haspopup="listbox" aria-expanded="${open}" data-can-animate `,
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

const switchRows = interactionRows<Props, 'closed' | 'open', SwitchInteraction>(
  { closed: { open: false }, open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  note: 'The project switch in the shell panel foot: badge, project name and an up-down chevron; it opens the project picker. SDK transparent button: SDK hover, press, focus ring and its 120 ms fade. Plain text at rest, and the chevron sits after the name, not at the right edge.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra'],
  states: {
    ...switchRows.states,
    'project.option-hover': { open: true, option: 'hover' },
    'project.option-focus-visible': { open: true, option: 'focus-visible' },
    'project.option-selected': { open: true, option: 'selected' },
  },
  grid: switchRows.grid,
  implements: 'apps/ethlete-studio/src/app/design-parts/shell-project-switch/shell-project-switch.component.ts',
  controls: { project: { kind: 'select', input: ['pointer', 'keyboard'], surfaces: { open: 'open' } } },
  styles: shellProjectSwitchStyles,
  render: async (props: Props) => {
    const projectMenu = props.open ? await menu.render({ rows: projectRows(props.option) }) : null;

    return drawing({
      body: html`<div class="relative box-border w-62 p-space-2 bg-et-surface-bg text-et-surface font-ui text-ui-md">
        ${shellProjectSwitch(props)}
        ${
          projectMenu
            ? html`<div class="st-shell-project-menu absolute left-0 box-border w-62" data-et-surface="project.open">
                ${projectMenu.body}
              </div>`
            : ''
        }
      </div>`,
      styles: projectMenu ? shellProjectSwitchStyles + projectMenu.styles : undefined,
    });
  },
});
