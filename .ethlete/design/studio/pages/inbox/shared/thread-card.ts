import { kbd, kbdStyles } from '@ethlete/components/design/kbd';
import { control } from '@ethlete/components/design/control';
import { html, withAction } from '@design-system';
import button from '@system/components/button';
import textarea from '@system/components/textarea';
import { type Agent, agentLogo } from '@system/foundations/agent-logos';
import { icon } from '@system/foundations/icons';

export type Message = { author: string; initials: string; agent?: Agent; when: string; text: string; own?: boolean };

export type SendPhase = 'busy' | 'error' | 'rejected';

export type Dock = 'canvas' | 'panel';

type Props = {
  dock: Dock;
  place: string;
  messages: Message[];
  text?: string;
  phase?: SendPhase;
  reason?: string;
};

const problem = (text: string) =>
  html`<p
    class="m-0 flex items-center gap-space-1 text-et-theme-ink text-ui-xs"
    data-et-semantic-color="error"
    role="alert"
  >
    ${icon('error', { size: 14, cls: 'flex-none text-et-theme' })}<span>${text}</span>
  </p>`;

const avatar = (m: Message) =>
  html`<span
    class="st-crow-avatar flex flex-none items-center justify-center size-5 bg-et-surface-bg text-et-surface text-(length:--text-xs) font-ui-strong"
    data-et-auto-surface
    >${m.agent ? agentLogo(m.agent, 'size-3') : m.initials}</span
  >`;

export const threadCard = async ({ dock, place, messages, text = '', phase, reason = '' }: Props) => {
  const busy = phase === 'busy';
  const close =
    dock === 'canvas'
      ? await button.render({
          iconOnly: true,
          icon: icon('close', { size: 14 }),
          ariaLabel: 'Faden schließen',
          variant: 'transparent',
          color: 'surface',
          size: 'xs',
        })
      : await button.render({
          label: 'Alle Kommentare',
          icon: icon('arrow-left', { size: 14 }),
          variant: 'transparent',
          color: 'surface',
          size: 'xs',
        });
  const resolve = await button.render({
    label: 'Erledigen',
    icon: icon('check', { size: 14 }),
    variant: 'outline',
    color: 'surface',
    size: 'xs',
  });
  const withdraw = await button.render({ label: 'Zurückziehen', variant: 'transparent', color: 'surface', size: 'xs' });
  const field = await textarea.render({
    field: {
      id: 'thread-reply',
      placeholder: 'Antworten…',
      rows: 2,
      ariaLabel: 'Antwort',
      disabled: busy,
      ...(busy ? {} : { focused: true, force: 'focus-visible' as const }),
      ...(text ? { value: text } : {}),
    },
  });
  const send = await button.render({
    label: phase === 'error' ? 'Erneut senden' : 'Antworten',
    variant: 'filled',
    size: 'xs',
    disabled: !text,
    loading: busy,
  });
  const sendMarkup = busy || !text ? send.body : withAction(send.body, 'emit:replyComment');
  const withdrawAction = control(withAction(withdraw.body, 'emit:withdrawComment'), 'thread-withdraw');

  const message = (m: Message) =>
    html`<li class="flex gap-space-2">
      ${avatar(m)}
      <div class="flex flex-1 flex-col gap-0.5 min-w-0">
        <div class="flex items-center gap-space-1 text-ui-xs whitespace-nowrap">
          <span class="text-et-surface font-ui-medium">${m.author}</span>
          <span class="flex-1 text-et-surface-muted">${m.when}</span>
        </div>
        <p class="m-0 text-et-surface text-ui-sm">${m.text}</p>
        ${m.own ? html`<div class="-ml-space-2 flex">${withdrawAction}</div>` : ''}
      </div>
    </li>`;

  const head =
    dock === 'canvas'
      ? html`<div class="flex items-center gap-space-2 border-b border-et-surface-border px-space-3 py-space-2">
          <span
            class="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-code text-ui-xs text-et-surface-muted"
            >${place}</span
          >
          ${control(withAction(resolve.body, 'emit:resolveThread'), 'thread-resolve')}${control(
            withAction(close.body, 'open'),
            'thread-close',
          )}
        </div>`
      : html`<div class="flex flex-col gap-space-1 border-b border-et-surface-border px-space-2 py-space-2">
          <div class="flex items-center justify-between gap-space-2">
            ${control(withAction(close.body, 'open'), 'thread-close')}${control(
              withAction(resolve.body, 'emit:resolveThread'),
              'thread-resolve',
            )}
          </div>
          <span class="px-space-1 font-code text-ui-xs text-et-surface-muted">${place}</span>
        </div>`;

  const frame =
    dock === 'canvas'
      ? 'relative z-20 w-80 rounded-md border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) shadow-lg'
      : 'h-full min-h-0';

  return {
    body: html`<div
      class="flex flex-col ${frame}"
      ${dock === 'canvas' ? 'data-et-auto-surface' : ''}
      role="dialog"
      aria-label="Kommentar-Faden"
    >
      ${head}
      <ol
        class="m-0 flex list-none flex-col gap-space-3 overflow-auto p-space-3 ${dock === 'canvas' ? 'max-h-96' : 'flex-1 min-h-0'}"
      >
        ${messages.map(message).join('')}
      </ol>
      <div class="flex flex-col gap-space-2 border-t border-et-surface-border p-space-3">
        ${field.body}${phase === 'error' ? problem('Kommentar nicht gesendet. Erneut versuchen.') : phase === 'rejected' ? problem(reason) : ''}
        <div class="flex items-center justify-between gap-space-2">
          <span class="flex items-center gap-space-1 text-ui-xs text-et-surface-muted"
            >${kbd({ keys: ['Esc'] })} schließt</span
          >
          ${control(sendMarkup, 'thread-send')}
        </div>
      </div>
    </div>`,
    styles: close.styles + resolve.styles + withdraw.styles + field.styles + send.styles + kbdStyles,
  };
};
