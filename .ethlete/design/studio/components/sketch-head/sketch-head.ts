import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, withAction } from '@design-system';
import badge from '@system/components/badge';
import button from '@system/components/button';
import { commentButton } from '@system/components/comment-flow';
import select from '@system/components/select';
import switchPart from '@system/components/switch';
import { holdTrigger, holdTriggerStyles } from '@system/components/hold-trigger';
import { type SketchBadgeStatus, sketchStatusBadge } from '@system/components/sketch-status-badge';
import { AGENT_RUNS, type AgentProgress, HOLD, IDLE, modelName, toggleHold } from './sketch-status';

export { AGENT_RUNS, type AgentProgress, type AgentRun, modelName, OPUS, SOL } from './sketch-status';
import styles from './sketch-head.css?inline';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';
import { BUILD_READY_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

export type SketchHeadStatus = Exclude<SketchBadgeStatus, 'idle'>;

export type MergePort = 'one' | 'two';

export type SketchHead = {
  title: string;
  round: string;
  status?: SketchHeadStatus;
  readyReason?: string;
  fresh?: boolean;
  autoMerge?: boolean;
  question?: string;
  discardable?: boolean;
  error?: string;
  retry?: boolean;
  commentToggle?: string;
  discardDialog?: string;
  agent?: AgentProgress;
  port?: MergePort;
  withdrawn?: { count: number; shown: boolean };
};

const QUESTION = 'Wo soll der Reset-Knopf der Zoom-Pille stehen?';
const ROUND = 'Runde 1 · Reset control: SDK button or own part';
const TITLE = 'components/zoom-chip';
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
          <span>·</span>${modelName(HOLD.by)}<span>· ${HOLD.since}</span>`,
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
  const after =
    status === 'not-ready'
      ? html`<span class="line-clamp-2 min-w-0 text-ui-sm text-et-surface-muted" data-sk-not-ready
          >${readyReason ?? SKETCHES_LABELS.notReadyUnknown} · ${IDLE.last} · ${IDLE.since}</span
        >`
      : '';
  return { styles: tag.styles, body: html`<span class="flex items-center gap-space-2">${tag.body} ${after}</span>` };
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
      >${run.task}</span
    >
    <span>· ${run.step} · ${run.since}</span>
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

export const sketchHead = async ({
  title,
  round,
  status = 'waiting',
  readyReason,
  fresh = false,
  autoMerge = false,
  question = '',
  discardable = true,
  error,
  retry = false,
  commentToggle = '',
  discardDialog = '',
  agent,
  port,
  withdrawn,
}: SketchHead) => {
  const freshTag = fresh ? await tonal(SKETCHES_LABELS.fresh) : undefined;
  const autoTag = autoMerge ? await tonal(SKETCHES_LABELS.autoMerge) : undefined;
  const shown = (agent && !agent.failed) || port ? 'drawing' : status;
  const state = await statusMarkup(shown, readyReason);
  const discard = await button.render({
    label: SKETCHES_LABELS.discard,
    variant: 'transparent',
    size: 'sm',
    color: 'danger',
  });
  const reload = await button.render({
    label: SKETCHES_LABELS.reload,
    variant: 'outline',
    color: 'surface',
    size: 'sm',
  });
  const picker = await select.render({
    label: '',
    size: 'sm',
    variant: 'ghost',
    clearable: false,
    value: 'round-1',
    options: [{ value: 'round-1', label: round }],
  });
  const toggle = withdrawn
    ? ((await switchPart.render({
        label: `Zurückgezogene (${withdrawn.count})`,
        size: 'sm',
        checked: withdrawn.shown,
      })) as { body: string; styles: string })
    : undefined;
  const body = html`<div class="relative flex flex-col gap-space-2" data-sk-head>
    <header class="relative z-3 flex items-center gap-space-3">
      <span class="text-ui-lg font-ui-strong">${title}</span>
      ${freshTag?.body ?? ''} ${state.body}
      ${
        autoTag
          ? html`<span class="flex w-fit" data-et-semantic-color="success" data-sk-auto-merge>${autoTag.body}</span>`
          : ''
      }
      <span class="flex-1"></span>
      <span class="w-56 flex-none" data-sk-view-toggle-room></span>
      ${
        error
          ? html`<p
              class="m-0 text-ui-xs text-et-theme-ink"
              data-et-semantic-color="error"
              role="alert"
              data-sk-head-error
            >
              ${error}
            </p>`
          : ''
      }
      ${
        !discardable
          ? html`<span class="text-ui-sm text-et-surface-muted whitespace-nowrap" data-sk-edit-hint
              >${SKETCHES_LABELS.editHint}</span
            >`
          : commentToggle +
            (retry ? withAction(control(reload.body, 'retry'), 'emit:retry') : '') +
            html`<span class="relative flex" data-sk-discard
              >${withAction(control(discard.body, 'discard'), 'emit:discard')}${discardDialog}</span
            >`
      }
    </header>
    ${
      question
        ? html`<p class="relative z-2 m-0 truncate text-ui-md font-ui-medium text-et-surface" data-sk-question>
            ${question}
          </p>`
        : ''
    }
    <div class="zr-picker relative z-2 flex items-center gap-space-4">
      ${withAction(picker.body, { action: 'emit:roundChange', on: '.et-select-trigger' })}
      ${agent ? agentLine(agent) : ''} ${port ? portLine(port) : ''}
      ${toggle ? withAction(control(toggle.body, 'withdrawn'), { action: 'emit:withdrawnToggle', on: '.et-switch' }) : ''}
    </div>
  </div>`;
  return {
    body,
    styles:
      (freshTag?.styles ?? '') +
      (autoTag?.styles ?? '') +
      state.styles +
      discard.styles +
      reload.styles +
      picker.styles +
      (toggle?.styles ?? '') +
      holdTriggerStyles +
      styles,
    setup: toggleHold,
  };
};

type Props = Omit<SketchHead, 'title' | 'round' | 'commentToggle' | 'retry'> & {
  title?: string;
  round?: string;
  commentable?: boolean;
  listError?: boolean;
};

const NOT_READY_REASON = 'components/title-bar b: SHOT-NOT-VIEWED default draws a pixel diff nobody viewed';
const MERGE_ERROR = 'components/zoom-chip hat sich seit dem Sketch geändert. Lass deinen Agent den Sketch rebasen.';

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/sketch-head/sketch-head.component.ts',
  note: 'The head of the Sketches page: part key, status and actions in the top row, the open round question as one line below it (ending in an ellipsis when longer than the line), and the round picker with the agent line and the withdrawn switch under that.',
  madeBy: ['claude-opus-5-5'],
  widths: [1200],
  states: {
    plain: { withdrawn: { count: 2, shown: false } },
    'question-short': { question: QUESTION },
    'question-long': {
      question: `${QUESTION} Und soll Einpassen neben ihm bleiben, wenn die Pille schmaler wird als die Zoomstufe mit ihrem Prozentzeichen?`,
    },
    agent: { round: SECOND_ROUND, agent: AGENT_RUNS.round },
    edit: { discardable: false, fresh: true, autoMerge: true, round: BUILD_READY_LABELS.groups['direct-edit'] },
    'not-ready': { status: 'not-ready', readyReason: NOT_READY_REASON },
    'not-ready-unknown': { status: 'not-ready' },
    error: { error: MERGE_ERROR },
    'comments-retry': { commentable: true, listError: true },
    paused: { status: 'paused' },
    'port-one': { port: 'one' },
    'port-two': { port: 'two' },
  },
  groups: [
    { label: 'Runde', states: ['plain', 'question-short', 'question-long', 'edit'] },
    { label: 'Status', states: ['paused', 'not-ready', 'not-ready-unknown'] },
    { label: 'Agent', states: ['agent', 'port-one', 'port-two'] },
    { label: 'Aktionen', states: ['comments-retry'] },
    { label: 'Fehler', states: ['error'] },
  ],
  describe: {
    plain:
      'A round without a question; check the picker one row under the head row and the withdrawn switch beside it.',
    'question-short':
      'An open round question; check the one medium line between the head row and the picker, which moves down by it.',
    'question-long':
      'A question longer than the head; check that it stays on one line and ends in an ellipsis before the right edge.',
    agent:
      'An agent drawing the round; check the zeichnet badge and the pulsing agent line with model, task and step beside the picker.',
    edit: 'A direct edit; check the neu and Auto-Merge tags and the edit hint in place of Verwerfen.',
    'not-ready':
      'A sketch that failed sketch ready; check Noch nicht bereit with the first line of its rejection and the last change.',
    'not-ready-unknown':
      'A sketch never run through sketch ready; check Noch nicht bereit with the hint to run sketch ready.',
    error: 'A merge that failed outside the rows; check the server reason in the error colour before Verwerfen.',
    'comments-retry':
      'A commentable sketch whose listing failed; check Kommentar, then Erneut laden, then Verwerfen in the head row.',
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
    withdrawn: { kind: 'button', part: 'components/switch' },
  },
  render: async ({ title = TITLE, round = ROUND, commentable = false, listError = false, ...head }: Props) => {
    const toggle = commentable ? await commentButton({ on: false, action: 'comments' }) : undefined;
    const {
      body,
      styles: css,
      setup,
    } = await sketchHead({ title, round, commentToggle: toggle?.body, retry: listError, ...head });
    return drawing({ body, styles: css + (toggle?.styles ?? ''), setup: [setup] });
  },
});
