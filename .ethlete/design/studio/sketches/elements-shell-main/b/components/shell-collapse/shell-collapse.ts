import { definePart, drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import { button, buttonStyles } from '@ethlete/components/design/button';
import { icon } from '@system/foundations/icons';

type CollapseInteraction = Exclude<Interaction, 'disabled'>;

type Props = { interaction?: CollapseInteraction };

export const shellCollapseStyles = buttonStyles;

export const shellCollapse = ({ interaction }: Props = {}) => {
  const markup = button({
    label: icon('panel', { size: 18 }),
    variant: 'transparent',
    color: 'surface',
    size: 'sm',
    class: 'size-control-sm p-0',
  }).replace(
    /^<button /,
    '<button data-et-control="collapse" title="Hide panel" aria-label="Hide panel" data-can-animate ',
  );

  return interaction ? forceInteraction(markup, interaction) : markup;
};

export default definePart({
  note: 'The button in the shell panel head that hides the panel. SDK transparent button: SDK hover, press, focus ring and its 120 ms fade; no hairline ring or raised fill at rest.',
  ...interactionRows<Props, 'collapse', CollapseInteraction>(
    { collapse: {} },
    { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
  ),
  controls: { collapse: { kind: 'button', input: ['pointer', 'keyboard'] } },
  styles: buttonStyles,
  render: (props: Props) =>
    drawing({
      body: html`<div class="inline-flex p-space-2 bg-surface text-text font-ui">${shellCollapse(props)}</div>`,
    }),
});
