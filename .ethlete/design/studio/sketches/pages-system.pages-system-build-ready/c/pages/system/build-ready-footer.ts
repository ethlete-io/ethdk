import { control } from '@ethlete/components/design/control';
import { html, withAction } from '@design-system';
import button from '@system/components/button';
import {
  agentLabel,
  agentMark,
  blockerGroupsOf,
  blockerIcon,
  slowRules,
  statusIcon,
  statusLabel,
  type AgentProgress,
  type BuildReady,
} from '@shared/build-ready';

type Row = { title: string; icon: Parameters<typeof blockerIcon>[0]; text: string; direct: boolean };

const rowsOf = (status: BuildReady): Row[] =>
  status.state === 'blocked'
    ? blockerGroupsOf(status.blockers).flatMap(({ kind, title, icon, blockers }) =>
        blockers.map(({ text }) => ({ title, icon, text, direct: kind === 'direct-edit' })),
      )
    : [];

const agentLine = (agent: AgentProgress) =>
  html`<div
    class="flex items-center gap-space-2 mt-space-1 ps-space-6 text-ui-xs"
    ${agent.state === 'failed' ? 'data-et-semantic-color="error"' : ''}
  >
    ${agentMark(agent)}<span class="flex-none text-et-surface">${agentLabel(agent)}</span
    ><span class="min-w-0 flex-1 truncate text-et-surface-muted">${agent.detail}</span>
  </div>`;

export const buildReadyView = async (status: BuildReady, agent: AgentProgress | undefined, open: boolean) => {
  const rows = rowsOf(status);
  const [first, ...rest] = rows;
  const openSketch = await button.render({ label: 'Sketch öffnen', variant: 'outline', size: 'xs' });
  const more = await button.render({
    label: open ? 'weniger' : `+${rest.length} weitere`,
    variant: 'transparent',
    size: 'xs',
    pressed: open,
  });
  const sketchButton = control(withAction(openSketch.body, 'emit:openEditSketch'), 'open-edit-sketch');
  const moreButton = rest.length > 0 ? control(withAction(more.body, open ? 'part' : 'blockers-open'), 'more') : '';
  const inline =
    status.state === 'checking'
      ? html`<span class="min-w-0 flex-1 truncate font-code text-et-surface-muted text-ui-xs"
          >${slowRules.join(', ')}</span
        >`
      : first
        ? html`<span class="min-w-0 flex-1 truncate text-et-surface-muted">${first.text}</span>`
        : html`<span class="flex-1"></span>`;
  const restList =
    open && rest.length > 0
      ? html`<ul class="m-0 mt-space-1 p-0 ps-space-6 list-none">
          ${rest
            .map(
              ({ title, icon, text }) =>
                html`<li class="flex items-center gap-space-2 py-0.5">
                  ${blockerIcon(icon)}<span class="min-w-0 flex-1 truncate text-et-surface">${text}</span
                  ><span class="flex-none text-et-surface-muted text-ui-xs">${title}</span>
                </li>`,
            )
            .join('')}
        </ul>`
      : '';

  return {
    before: '',
    footer: html`<footer class="border-t border-(--et-surface-border-solid) px-space-3 py-space-2">
      <div class="flex items-center gap-space-2">
        ${statusIcon(status)}<span class="flex-none font-ui-strong text-et-surface">${statusLabel(status)}</span
        >${inline}${first?.direct ? sketchButton : ''}${moreButton}
      </div>
      ${restList}${agent ? agentLine(agent) : ''}
    </footer>`,
    styles: openSketch.styles + more.styles,
  };
};
