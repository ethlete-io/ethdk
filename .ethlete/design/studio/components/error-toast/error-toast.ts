import { definePart, drawing, interactionRows } from '@design-system';
import { notification, notificationStack, notificationStyles } from '@ethlete/components/design/notification';

type CloseInteraction = 'hover' | 'active' | 'focus-visible';

type Props = { heading: string; message: string; interaction?: CloseInteraction };

const READABLE = `@layer utilities {
  .et-notification {
    --et-notification-message-opacity: 1;
  }

  .et-notification-dismiss-btn {
    opacity: 0.6;

    @media (hover: hover) {
      &:hover {
        opacity: 0.8;
      }
    }
  }
}`;

export const { states, grid } = interactionRows<Props, 'close', CloseInteraction>(
  {
    close: {
      heading: 'Ordner nicht geöffnet',
      message: 'In diesem Ordner liegt keine Design-Arbeit.',
    },
  },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/error-toast/error-toast.component.ts',
  note: 'The error toast Studio shows when "Projekt öffnen…" picks a folder without design work. The SDK notification in its error status on the danger theme: title, message and the dismiss button; it stays until dismissed. The host places it in the bottom-right corner. The message reads at full opacity and the dismiss icon at 0.6 at rest, so both pass contrast; the dismiss row draws the button at rest, hovered, pressed and focused.',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5'],
  states,
  grid,
  widths: [480],
  controls: { close: { kind: 'button', input: ['pointer', 'keyboard'] } },
  render: ({ heading, message, interaction }: Props) =>
    drawing({
      body: notificationStack([
        notification({
          status: 'error',
          color: 'danger',
          title: heading,
          message,
          attributes: 'data-et-surface-fill',
          dismissAttributes: [
            'data-et-control="close" data-et-action="emit:dismiss" data-can-animate',
            interaction && `data-et-force="${interaction}"`,
          ]
            .filter(Boolean)
            .join(' '),
        }),
      ]),
      styles: [notificationStyles, READABLE].join('\n'),
    }),
});
