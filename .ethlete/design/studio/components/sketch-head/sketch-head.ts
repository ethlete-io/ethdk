import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, withAction } from '@design-system';
import badge from '@system/components/badge';
import { iconButton, iconButtonStyles } from '@ethlete/components/design/button';
import button from '@system/components/button';
import menu from '@system/components/menu';
import { icon } from '@system/foundations/icons';
import switchPart from '@system/components/switch';
import { holdTrigger, holdTriggerStyles } from '@system/components/hold-trigger';
import { type SketchBadgeStatus, sketchStatusBadge } from '@system/components/sketch-status-badge';
import { AGENT_RUNS, type AgentProgress, HOLD, modelName, toggleHold } from './sketch-status';

export { AGENT_RUNS, type AgentProgress, type AgentRun, modelName, OPUS, SOL } from './sketch-status';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';
import { BUILD_READY_LABELS, SYSTEM_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

export type SketchHeadStatus = SketchBadgeStatus;

export type MergePort = 'one' | 'two';

export type SketchHead = {
  round: string;
  rounds?: string[];
  roundsOpen?: boolean;
  status?: SketchHeadStatus;
  readyReason?: string;
  autoMerge?: boolean;
  discardable?: boolean;
  error?: string;
  retry?: boolean;
  comment?: { on: boolean; action?: string };
  discardDialog?: string;
  agent?: AgentProgress;
  port?: MergePort;
  withdrawn?: { count: number; shown: boolean };
  class?: string;
};

const ROUND = 'Runde 1 · Reset control: SDK button or own part';
const SECOND_ROUND = 'Runde 2 · Port nach dem Merge';

const MERGE_PORTS: Record<MergePort, { merged: string[]; since: string }> = {
  one: { merged: ['components/button'], since: 'seit 1 Min' },
  two: { merged: ['components/sketch-status-badge', 'elements/variant-cell'], since: 'seit 1 Min' },
};

const tonal = async (label: string) =>
  (await badge.render({ badges: [{ label, variant: 'tonal', size: 'sm' }] })) as { body: string; styles: string };

const statusMarkup = async (status: SketchHeadStatus, readyReason?: string) => {
  const tag = await sketchStatusBadge(status);
  if (status === 'paused') {
    return {
      styles: tag.styles,
      body: holdTrigger({
        content: tag.body,
        open: false,
        reason: html`<span class="font-ui-medium text-et-surface">Wartet auf ${HOLD.until}</span>
          <span>· ${HOLD.since}</span>`,
      }),
    };
  }
  if (status === 'failed') {
    return {
      styles: tag.styles,
      body: html`<span class="flex min-w-0 items-center gap-space-2"
        >${tag.body}
        ${
          readyReason
            ? html`<span class="line-clamp-2 min-w-0 text-ui-sm text-et-surface-muted" data-sk-failed
                >${readyReason}</span
              >`
            : ''
        }</span
      >`,
    };
  }
  return { styles: tag.styles, body: html`<span class="flex items-center gap-space-2">${tag.body}</span>` };
};

const agentLine = (run: AgentProgress) =>
  html`<span
    class="flex min-w-0 items-center gap-space-2 text-ui-sm text-et-surface-muted whitespace-nowrap"
    data-sk-agent
    ${run.failed ? 'data-et-semantic-color="error"' : ''}
  >
    <span
      class="size-2 flex-none rounded-full bg-(--et-theme-color-primary-solid) ${run.failed ? '' : 'animate-pulse'}"
    ></span>
    ${modelName(run.by)}
    <span class="font-ui-medium ${run.failed ? 'text-(--et-theme-color-primary-solid)' : 'text-et-surface'}"
      >${run.failed ? run.task : SKETCHES_LABELS.drawingMark}</span
    >
    <span>· ${run.since}</span>
  </span>`;

const portLine = (port: MergePort) =>
  html`<span
    class="flex min-w-0 items-center gap-space-2 text-ui-sm text-et-surface-muted whitespace-nowrap"
    data-sk-merge-port
  >
    <span
      class="size-2 flex-none rounded-full bg-(--et-theme-color-primary-solid)"
      data-et-semantic-color="warning"
    ></span>
    <span class="truncate font-ui-medium text-et-surface"
      >Agent portiert nach Merge von ${MERGE_PORTS[port].merged.join(', ')}</span
    >
    <span>· ${MERGE_PORTS[port].since}</span>
  </span>`;

const trayClass =
  'rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border-solid)) bg-et-surface-bg shadow-(--et-anchored-panel-shadow,0_10px_24px_rgb(var(--et-shadow-color-rgb,0_0_0)/0.16))';

const roundMenu = async (rounds: string[], open: boolean) => {
  const trigger = iconButton({
    icon: icon('history', { cls: 'et-icon' }),
    ariaLabel: SKETCHES_LABELS.roundSelect,
    size: 'sm',
    variant: 'transparent',
    color: 'surface',
  });
  const panel = open
    ? await menu.render({
        rows: [
          {
            kind: 'radio-group',
            label: SKETCHES_LABELS.roundSelect,
            items: rounds.map((label, index) => ({ kind: 'radio', label, checked: index === 0 })),
          },
        ],
      })
    : undefined;
  return {
    body: html`<div class="relative flex" data-sk-round>
      ${withAction(control(trigger, 'round'), 'emit:roundChange')}
      ${
        panel
          ? html`<div class="absolute bottom-full left-1/2 mb-space-2 w-80 -translate-x-1/2" data-sk-round-menu>
              ${panel.body}
            </div>`
          : ''
      }
    </div>`,
    styles: panel?.styles ?? '',
  };
};

export const sketchHead = async ({
  round,
  rounds = [round],
  roundsOpen = false,
  status = 'waiting',
  readyReason,
  autoMerge = false,
  discardable = true,
  error,
  retry = false,
  comment,
  discardDialog = '',
  agent,
  port,
  withdrawn,
  class: hostClass = '',
}: SketchHead) => {
  const autoTag = autoMerge ? await tonal(SKETCHES_LABELS.autoMerge) : undefined;
  const shown = (agent && !agent.failed) || port ? 'drawing' : status;
  const state = await statusMarkup(shown, readyReason);
  const discard = iconButton({
    icon: icon('trash', { cls: 'et-icon' }),
    ariaLabel: SKETCHES_LABELS.discard,
    size: 'sm',
    variant: 'transparent',
    color: 'danger',
  });
  const commentToggle = comment
    ? iconButton({
        icon: icon('comment', { cls: 'et-icon' }),
        ariaLabel: SYSTEM_LABELS.comment,
        size: 'sm',
        variant: 'transparent',
        color: 'surface',
        pressed: comment.on,
      }).replace('<button ', '<button data-sk-comment ')
    : '';
  const reload = await button.render({
    label: SKETCHES_LABELS.reload,
    variant: 'outline',
    color: 'surface',
    size: 'sm',
  });
  const picker = await roundMenu(rounds, roundsOpen);
  const toggle = withdrawn
    ? ((await switchPart.render({
        label: `Zurückgezogene (${withdrawn.count})`,
        size: 'sm',
        checked: withdrawn.shown,
      })) as { body: string; styles: string })
    : undefined;
  const body = html`<div class="flex flex-col items-center gap-space-2 ${hostClass}" data-et-surface-auto>
    ${
      error
        ? html`<p
            class="m-0 max-w-5xl px-space-3 py-space-2 text-ui-xs text-et-theme-ink ${trayClass}"
            data-et-semantic-color="error"
            role="alert"
            data-sk-head-error
          >
            ${error}
          </p>`
        : ''
    }
    <div
      class="flex max-w-full items-center gap-space-2 py-space-1 ps-space-3 pe-space-1 font-ui ${trayClass}"
      role="toolbar"
      aria-label="${SKETCHES_LABELS.toolbar}"
      data-sk-toolbar
    >
      ${state.body}
      ${
        autoTag
          ? html`<span class="flex w-fit" data-et-semantic-color="success" data-sk-auto-merge>${autoTag.body}</span>`
          : ''
      }
      ${agent ? agentLine(agent) : ''} ${port ? portLine(port) : ''}
      ${toggle ? withAction(control(toggle.body, 'withdrawn'), { action: 'emit:withdrawnToggle', on: '.et-switch' }) : ''}
      <span class="mx-space-1 h-5 w-px flex-none bg-et-surface-border" aria-hidden="true"></span>
      ${picker.body}
      ${discardable && comment ? withAction(control(commentToggle, 'comment'), comment.action ?? 'emit:commentMode') : ''}
      ${discardable && retry ? withAction(control(reload.body, 'retry'), 'emit:retry') : ''}
      ${
        discardable
          ? html`<span class="relative flex" data-sk-discard
              >${withAction(control(discard, 'discard'), 'emit:discard')}${discardDialog}</span
            >`
          : ''
      }
    </div>
  </div>`;
  return {
    body,
    styles:
      (autoTag?.styles ?? '') +
      state.styles +
      iconButtonStyles +
      reload.styles +
      picker.styles +
      (toggle?.styles ?? '') +
      holdTriggerStyles,
    setup: toggleHold,
  };
};

type Props = Omit<SketchHead, 'round' | 'comment' | 'retry' | 'class'> & {
  round?: string;
  commentable?: boolean;
  listError?: boolean;
};

const MERGE_ERROR = 'components/zoom-chip hat sich seit dem Sketch geändert. Lass deinen Agent den Sketch rebasen.';

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-head/sketch-head.component.ts',
  note: 'The floating toolbar at the bottom of the Sketches canvas: status, agent line and withdrawn switch, then the round menu, Kommentar and Verwerfen as icon buttons.',
  madeBy: ['claude-opus-5-5'],
  widths: [1200],
  states: {
    plain: { withdrawn: { count: 2, shown: false } },
    agent: { round: SECOND_ROUND, agent: AGENT_RUNS.round },
    edit: { discardable: false, autoMerge: true, round: BUILD_READY_LABELS.groups['direct-edit'] },
    error: { error: MERGE_ERROR },
    'comments-retry': { commentable: true, listError: true },
    paused: { status: 'paused' },
    'port-one': { port: 'one' },
    'port-two': { port: 'two' },
    rounds: { rounds: [ROUND, SECOND_ROUND], roundsOpen: true },
  },
  groups: [
    { label: 'Runde', states: ['plain', 'edit', 'rounds'] },
    { label: 'Status', states: ['paused'] },
    { label: 'Agent', states: ['agent', 'port-one', 'port-two'] },
    { label: 'Aktionen', states: ['comments-retry'] },
    { label: 'Fehler', states: ['error'] },
  ],
  describe: {
    plain:
      'A round; check one floating toolbar with no title: the status, the withdrawn switch, then the history and Verwerfen icon buttons.',
    rounds: 'The round menu open; check the et-menu above the history button with the shown round checked.',
    agent:
      'An agent drawing the round; check the zeichnet badge and the pulsing agent line with the model, zeichnet and its time beside the picker.',
    edit: 'A direct edit; check the Auto-Merge tag and the edit hint in place of Verwerfen.',
    error: 'A merge that failed outside the rows; check the server reason in the error colour before Verwerfen.',
    'comments-retry':
      'A commentable sketch whose listing failed; check the Kommentar icon, then Erneut laden, then the Verwerfen icon.',
    paused: 'A paused sketch; check the Pausiert badge, which opens the hold reason on click.',
    'port-one':
      'The agent porting after one merge; check Agent portiert nach Merge von with the merged part beside the picker.',
    'port-two':
      'The agent porting after two merges; check that the longer port line stays on one line beside the picker.',
  },
  controls: {
    hold: { kind: 'button', part: 'components/hold-trigger' },
    comment: { kind: 'button', part: 'components/button' },
    retry: { kind: 'button', part: 'components/button' },
    discard: { kind: 'button', part: 'components/button' },
    round: { kind: 'button', part: 'components/button' },
    withdrawn: { kind: 'button', part: 'components/switch' },
  },
  render: async ({ round = ROUND, commentable = false, listError = false, ...head }: Props) => {
    const { body, styles, setup } = await sketchHead({
      round,
      comment: commentable ? { on: false, action: 'comments' } : undefined,
      retry: listError,
      ...head,
    });
    return drawing({
      body: head.roundsOpen ? html`<div class="pt-40">${body}</div>` : body,
      styles,
      setup: [setup],
    });
  },
});
