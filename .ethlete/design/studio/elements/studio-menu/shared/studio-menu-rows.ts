import { forceInteraction, type Interaction, withAction } from '@design-system';
import { button } from '@ethlete/components/design/button';
import { studioMark } from '@system/foundations/logo';

export type MenuInteraction = Exclude<Interaction, 'disabled'>;

export const studioTrigger = (open: boolean, interaction?: MenuInteraction) => {
  const markup = withAction(
    button({
      label: studioMark(40),
      variant: 'transparent',
      color: 'surface',
      size: 'sm',
      class: 'st-studio-trigger p-0 [--et-button-border-radius:var(--radius-control-lg)] [--et-button-border-width:0]',
    }).replace(
      /^<button /,
      `<button data-et-control="studio-menu" data-studio-trigger data-et-auto-surface aria-label="Studio-Menü" aria-haspopup="menu" aria-expanded="${open}" aria-controls="studio-menu-surface" `,
    ),
    open ? 'closed' : 'open',
  );
  return interaction ? forceInteraction(markup, interaction) : markup;
};

export const action = (name: string) => `data-studio-action="${name}" data-et-slot="components/menu"`;
