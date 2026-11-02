import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import styles from './shell-product.css?inline';

type ProductInteraction = Exclude<Interaction, 'disabled'>;

type Props = { product: string; active?: boolean; interaction?: ProductInteraction };

const HOVER_PRESS_RAISED =
  'hover:bg-linear-to-b hover:from-et-surface-interaction/9 hover:to-et-surface-interaction/9 active:bg-linear-to-b active:from-et-surface-interaction/15 active:to-et-surface-interaction/15';

export const shellProductStyles = styles;

export const shellProduct = ({ product, active = false, interaction }: Props) => {
  const markup = `<button type="button" data-et-control="product" data-can-animate="true" data-et-auto-surface class="st-shell-product flex items-center justify-center p-0 rounded-control-md bg-et-surface-bg text-ui-sm font-ui-strong ${active ? 'text-et-surface' : 'text-et-surface-muted'} ${HOVER_PRESS_RAISED}" aria-label="${product}" data-et-action="emit:productChange"${active ? ' aria-current="true"' : ''}>${product.charAt(0).toUpperCase()}</button>`;

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'A recent product in the shell rail: its initial on a raised surface bubble, muted at rest, with a hairline ring while active. Each row draws it at rest, hovered, pressed and focused, with the shell hover fill, pressed fill and inset focus ring on --transition-state.',
  madeBy: ['claude-opus-5-5'],
  ...interactionRows<Props, 'product' | 'current', ProductInteraction>(
    { product: { product: 'timetrack' }, current: { product: 'studio', active: true } },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { product: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles,
  render: (props: Props) =>
    drawing({
      body: html`<div class="inline-flex p-space-2 bg-et-surface-bg text-et-surface font-ui" data-et-surface>
        ${shellProduct(props)}
      </div>`,
    }),
});
