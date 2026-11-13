import {
  definePart,
  drawing,
  forceInteraction,
  html,
  interactionRows,
  type Interaction,
  withAction,
} from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import type { MenuMockRow } from '@ethlete/components/design/menu';
import menu from '@system/components/menu';
import { icon } from '@system/foundations/icons';
import styles from './shell-system-picker.css?inline';

type PickerInteraction = Exclude<Interaction, 'disabled'>;

type OptionInteraction = 'hover' | 'focus-visible';

type Props = {
  product?: string;
  products?: string[];
  open?: boolean;
  interaction?: PickerInteraction;
  option?: OptionInteraction | 'selected';
};

const MENU_ITEM = 'data-et-slot="components/menu"';

const PRODUCTS = ['studio', 'timetrack', 'docs'];

const systemRows = (product: string, products: string[], option?: Props['option'], keyboard = false): MenuMockRow[] => {
  const hovered = option && option !== 'selected' ? option : undefined;

  return [
    {
      kind: 'radio-group',
      label: 'Design-System',
      items: products.map((name, index) => {
        const current = name === product;
        const forced = index === 1 ? hovered : current && keyboard ? 'focus-visible' : undefined;

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

export const shellSystemPickerStyles = styles + buttonStyles;

export const shellSystemPicker = (
  { product = 'studio', open = false, interaction }: Props = {},
  actions: { open: string; closed: string } = { open: 'open', closed: 'closed' },
) => {
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
    open ? actions.closed : actions.open,
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export const shellSystemPickerMenu = async (
  { product = 'studio', products = PRODUCTS, option }: Props = {},
  keyboard = false,
) => menu.render({ rows: systemRows(product, products, option, keyboard) });

const force = (props: Props, interaction: PickerInteraction) => ({ ...props, interaction });

const closedRows = interactionRows<Props, 'closed', PickerInteraction>(
  { closed: { open: false } },
  { interactions: ['hover', 'active', 'focus-visible'], force },
);

const openRows = interactionRows<Props, 'open', PickerInteraction>(
  { open: { open: true } },
  { interactions: ['hover', 'active', 'focus-visible'], force },
);

export default definePart({
  note: 'The design-system choice in the shell panel head: product name and an up-down chevron; it opens an SDK menu of the design systems below it, the open one checked. SDK transparent button: SDK hover, press, focus ring and its 120 ms fade. SDK does not fit alone: no et-button size gives the control-md height with space-2 padding, a start-aligned truncating ui-lg label, so the trigger keeps its own classes.',
  madeBy: ['claude-opus-5-5'],
  states: {
    ...closedRows.states,
    ...openRows.states,
    'system.option-hover': { open: true, option: 'hover' },
    'system.option-focus-visible': { open: true, option: 'focus-visible' },
    'system.option-selected': { open: true, option: 'selected' },
  },
  grid: { columns: closedRows.grid.columns, rows: { ...closedRows.grid.rows, ...openRows.grid.rows } },
  controls: { system: { kind: 'select', input: ['pointer', 'keyboard'], surfaces: { open: 'open' } } },
  styles: shellSystemPickerStyles,
  render: async (props: Props) => {
    const keyboard = props.open === true && props.interaction === 'focus-visible';
    const panel = props.open ? await shellSystemPickerMenu(props, keyboard) : null;

    return drawing({
      body: html`<div class="relative box-border flex w-62 p-space-2 text-et-surface font-ui text-ui-md">
        ${shellSystemPicker(keyboard ? { ...props, interaction: undefined } : props)}
        ${
          panel
            ? html`<div
                class="st-shell-system-menu absolute top-full left-space-2 mt-space-1 box-border w-58"
                data-et-surface="system.open"
              >
                ${panel.body}
              </div>`
            : ''
        }
      </div>`,
      styles: panel ? shellSystemPickerStyles + panel.styles : undefined,
    });
  },
});
