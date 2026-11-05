import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, withAction } from '@design-system';
import button from '@system/components/button';
import textarea from '@system/components/textarea';
import { icon } from '@system/foundations/icons';

type Phase = 'busy' | 'error' | 'rejected';

type Props = { text?: string; phase?: Phase; reason?: string };

const problem = (text: string) =>
  html`<p
    class="m-0 flex items-center gap-space-1 text-et-theme-ink text-ui-xs"
    data-et-semantic-color="error"
    role="alert"
  >
    ${icon('error', { size: 14, cls: 'flex-none text-et-theme' })}<span>${text}</span>
  </p>`;

export const commentDraft = async ({ text = '', phase, reason = '' }: Props) => {
  const busy = phase === 'busy';
  const field = await textarea.render({
    field: {
      id: 'comment-draft',
      placeholder: 'Enter sendet, Umschalt+Enter macht einen Zeilenumbruch',
      rows: 3,
      ariaLabel: 'Kommentar',
      disabled: busy,
      ...(text ? { value: text } : {}),
    },
  });
  const send = await button.render({
    label: phase === 'error' ? 'Erneut senden' : 'Senden',
    variant: 'filled',
    size: 'xs',
    disabled: !text,
    loading: busy,
  });
  const sendMarkup = busy || !text ? send.body : withAction(send.body, 'emit:sendComment');
  const cancel = await button.render({
    label: 'Abbrechen',
    variant: 'transparent',
    color: 'surface',
    size: 'xs',
    disabled: busy,
  });
  const cancelMarkup = busy ? cancel.body : withAction(cancel.body, 'comment-mode');
  return {
    body: html`<div
      class="relative z-20 flex w-80 flex-col gap-space-2 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-space-3 shadow-lg"
      data-et-auto-surface
      role="dialog"
      aria-label="Kommentar schreiben"
    >
      ${field.body}${phase === 'error' ? problem('Kommentar nicht gesendet. Erneut versuchen.') : phase === 'rejected' ? problem(reason) : ''}
      <div class="flex justify-end gap-space-2">
        ${control(cancelMarkup, 'comment-cancel')}${control(sendMarkup, 'comment-send')}
      </div>
    </div>`,
    styles: field.styles + send.styles + cancel.styles,
  };
};

export default definePart({
  note: 'Shared comment draft after the system page: a bordered card with a three-row textarea, Abbrechen and a filled Senden, and the send error line. It stacks at z-20 so a canvas frame overlay no longer covers it.',
  madeBy: ['claude-sonnet-5-5', 'claude-opus-5-5'],
  widths: [360],
  motions: { busy: { from: 'busy', to: 'busy' } },
  instant: 'Typing and the error line change the draft at once; only the Senden spinner loops while busy.',
  controls: {
    'comment-send': { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
    'comment-cancel': { kind: 'button', input: ['pointer', 'keyboard'], disabled: true },
  },
  states: {
    empty: {},
    typed: { text: 'Tonal wirkt neben filled zu blass. Zieh die Fläche an, der Text bleibt wie er ist.' },
    busy: { text: 'Tonal wirkt neben filled zu blass.', phase: 'busy' },
    error: { text: 'Tonal wirkt neben filled zu blass.', phase: 'error' },
    rejected: {
      text: 'Tonal wirkt neben filled zu blass.',
      phase: 'rejected',
      reason: 'Der Teil components/button existiert nicht mehr.',
    },
  },
  frame: (body) => html`<div class="relative min-h-40 p-space-3">${body}</div>`,
  render: async (props: Props) => {
    const drawn = await commentDraft(props);
    return drawing({ body: drawn.body, styles: drawn.styles });
  },
});
