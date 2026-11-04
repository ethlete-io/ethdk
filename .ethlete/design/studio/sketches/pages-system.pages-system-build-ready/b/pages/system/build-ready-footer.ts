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

const agentStrip = (agent: AgentProgress) =>
  html`<div
    class="flex items-center gap-space-2 px-space-3 py-space-2 border-b border-(--et-surface-border-solid)"
    ${agent.state === 'failed' ? 'data-et-semantic-color="error"' : ''}
  >
    ${agentMark(agent)}<span class="flex-none font-ui-strong text-et-surface">${agentLabel(agent)}</span
    ><span class="min-w-0 flex-1 truncate text-et-surface-muted">${agent.detail}</span>
  </div>`;

const blockerSection = async (status: BuildReady) => {
  if (status.state !== 'blocked') return { body: '', styles: '' };

  const open = await button.render({ label: 'Sketch öffnen', variant: 'outline', size: 'xs' });
  const groups = blockerGroupsOf(status.blockers)
    .map(({ kind, icon, blockers }) =>
      blockers
        .map(
          ({ text }) =>
            html`<li class="flex items-center gap-space-2 px-space-3 py-space-1">
              ${blockerIcon(icon)}<span class="min-w-0 flex-1 truncate text-et-surface">${text}</span>
              ${kind === 'direct-edit' ? control(withAction(open.body, 'emit:openEditSketch'), 'open-edit-sketch') : ''}
            </li>`,
        )
        .join(''),
    )
    .join('');

  return {
    body: html`<section id="st-build-blockers" class="border-b border-(--et-surface-border-solid) py-space-1">
      <h3
        class="m-0 flex items-center gap-space-2 px-space-3 py-space-1 text-ui-xs font-ui-strong text-et-surface-muted"
      >
        Bis baubereit<span class="font-code font-normal">${status.blockers.length}</span>
      </h3>
      <ul class="m-0 p-0 list-none">
        ${groups}
      </ul>
    </section>`,
    styles: open.styles,
  };
};

const summary = (status: BuildReady) =>
  html`<span class="flex-none font-ui-strong text-et-surface">${statusLabel(status)}</span>${
      status.state === 'checking'
        ? html`<span class="min-w-0 truncate font-code text-et-surface-muted text-ui-xs">${slowRules.join(', ')}</span>`
        : ''
    }`;

export const buildReadyView = async (status: BuildReady, agent: AgentProgress | undefined) => {
  const section = await blockerSection(status);
  const link = await button.render({ label: 'Zu den Gründen', variant: 'transparent', size: 'xs' });

  return {
    before: (agent ? agentStrip(agent) : '') + section.body,
    footer: html`<footer
      class="flex items-center gap-space-2 border-t border-(--et-surface-border-solid) px-space-3 py-space-2"
    >
      ${statusIcon(status)}${summary(status)}
      ${
        status.state === 'blocked'
          ? html`<span class="ms-auto">${control(withAction(link.body, 'emit:scrollToBlockers'), 'reasons')}</span>`
          : ''
      }
    </footer>`,
    styles: section.styles + link.styles,
  };
};
