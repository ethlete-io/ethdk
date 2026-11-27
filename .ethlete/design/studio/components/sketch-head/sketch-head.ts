import { control } from '@ethlete/components/design/control';
import { definePart, drawing, html, withAction } from '@design-system';
import { iconButton, iconButtonStyles } from '@ethlete/components/design/button';
import menu from '@system/components/menu';
import { icon } from '@system/foundations/icons';
import switchPart from '@system/components/switch';
import { holdTrigger, holdTriggerStyles } from '@system/components/hold-trigger';
import { type SketchBadgeStatus, sketchStatusBadge } from '@system/components/sketch-status-badge';
import { HOLD, toggleHold } from './sketch-status';

export { AGENT_RUNS, type AgentProgress, type AgentRun, modelName, OPUS, SOL } from './sketch-status';
import { SKETCHES_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/sketches-labels';
import { BUILD_READY_LABELS, SYSTEM_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

export type SketchHeadStatus = SketchBadgeStatus;

export type SketchHeadRound = { value: string; label: string };

export type SketchHeadHold = { until: string; since: string };

export type SketchHead = {
  round: string;
  rounds?: SketchHeadRound[];
  roundsOpen?: boolean;
  status?: SketchHeadStatus;
  hold?: SketchHeadHold;
  autoMerge?: boolean;
  discardable?: boolean;
  error?: string;
  retry?: boolean;
  comment?: { on: boolean; action?: string };
  discardDialog?: string;
  withdrawn?: { count: number; shown: boolean };
  class?: string;
};

const ROUND = 'Runde 1 · Reset control: SDK button or own part';
const SECOND_ROUND = 'Runde 2 · Port nach dem Merge';

const statusMarkup = async (status: SketchHeadStatus, hold: SketchHeadHold) => {
  const tag = await sketchStatusBadge(status);
  if (status === 'paused') {
    return {
      styles: tag.styles,
      body: holdTrigger({
        content: tag.body,
        open: false,
        reason: html`<span class="font-ui-medium text-et-surface-text">Wartet auf ${hold.until}</span>
          <span>· ${hold.since}</span>`,
      }),
    };
  }
  return { styles: tag.styles, body: html`<span class="flex items-center gap-space-2">${tag.body}</span>` };
};

const trayClass =
  'rounded-control-md border border-(--et-overlay-surface-border-color,var(--et-surface-border)) bg-et-surface-background shadow-(--et-anchored-panel-shadow,0_10px_24px_color-mix(in_srgb,var(--et-shadow-color,rgb(0_0_0))_16%,transparent))';

const roundMenu = async (rounds: SketchHeadRound[], open: boolean) => {
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
            items: rounds.map(({ label }, index) => ({
              kind: 'radio',
              label,
              checked: index === 0,
              attributes: `data-et-action="${index === 0 ? 'emit:roundsOpenChange' : 'emit:roundChange'}"`,
            })),
          },
        ],
      })
    : undefined;
  return {
    body: html`<div class="relative flex" data-sk-round>
      ${withAction(control(trigger.replace('<button ', `<button aria-expanded="${open}" `), 'round'), 'emit:roundsOpenChange')}
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
  rounds = [{ value: round, label: round }],
  roundsOpen = false,
  status = 'waiting',
  hold = HOLD,
  autoMerge = false,
  discardable = true,
  error,
  retry = false,
  comment,
  discardDialog = '',
  withdrawn,
  class: hostClass = '',
}: SketchHead) => {
  const state = await statusMarkup(autoMerge && ['drawing', 'waiting'].includes(status) ? 'autoMerge' : status, hold);
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
  const reload = iconButton({
    icon: icon('refresh', { cls: 'et-icon' }),
    ariaLabel: SKETCHES_LABELS.reload,
    size: 'sm',
    variant: 'transparent',
    color: 'surface',
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
            class="m-0 max-w-5xl px-space-3 py-space-2 text-ui-xs text-et-tone-text ${trayClass}"
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
      ${toggle ? withAction(control(toggle.body, 'withdrawn'), { action: 'emit:withdrawnToggle', on: '.et-switch' }) : ''}
      <span class="mx-space-1 h-5 w-px flex-none bg-et-surface-border" aria-hidden="true"></span>
      ${picker.body}
      ${discardable && comment ? withAction(control(commentToggle, 'comment'), comment.action ?? 'emit:commentModeChange') : ''}
      ${discardable && retry ? withAction(control(reload, 'retry'), 'emit:retry') : ''}
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
    styles: state.styles + iconButtonStyles + picker.styles + (toggle?.styles ?? '') + holdTriggerStyles,
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
  note: 'The floating toolbar at the bottom of the Sketches canvas: one status (dot and word) and the withdrawn switch, then the round menu, Kommentar and Verwerfen as icon buttons. Model, failure and round text live on the rows, never here.',
  madeBy: ['claude-opus-5-5'],
  widths: [1200],
  states: {
    plain: { withdrawn: { count: 2, shown: false } },
    agent: { round: SECOND_ROUND, status: 'drawing' },
    edit: { discardable: false, autoMerge: true, round: BUILD_READY_LABELS.groups['direct-edit'] },
    error: { error: MERGE_ERROR },
    'comments-retry': { commentable: true, listError: true },
    paused: { status: 'paused', hold: HOLD },
    rounds: {
      round: ROUND,
      rounds: [ROUND, SECOND_ROUND].map((label) => ({ value: label, label })),
      roundsOpen: true,
    },
  },
  groups: [
    { label: 'Runde', states: ['plain', 'edit', 'rounds'] },
    { label: 'Status', states: ['paused'] },
    { label: 'Agent', states: ['agent'] },
    { label: 'Aktionen', states: ['comments-retry'] },
    { label: 'Fehler', states: ['error'] },
  ],
  describe: {
    plain:
      'A round; check one floating toolbar with no title: the status, the withdrawn switch, then the history and Verwerfen icon buttons.',
    rounds: 'The round menu open; check the et-menu above the history button with the shown round checked.',
    agent:
      'An agent drawing the round; check the zeichnet badge as the only text, with no model, time or round line beside it.',
    edit: 'A direct edit; check Automatisch as the only status, and no Verwerfen.',
    error: 'A merge that failed outside the rows; check the server reason in the error colour before Verwerfen.',
    'comments-retry':
      'A commentable sketch whose listing failed; check the Kommentar icon, then Erneut laden, then the Verwerfen icon.',
    paused: 'A paused sketch; check the Pausiert badge, which opens the hold reason on click.',
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
      comment: commentable ? { on: false } : undefined,
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
