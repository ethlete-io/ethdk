import { css, drawing, html } from '@design-explore';
import { band, DAY_STYLES, dayView } from './day';
import {
  approvableByAll,
  CALL_ROW,
  clock,
  CODE_ROW,
  CREATE,
  CREATE_DRAFT,
  duration,
  PendingAction,
  span,
  SYNC,
  SYNC_DAY_LABEL,
  UNNAMED,
  WORKLOG,
  WORKLOG_DETAIL,
} from './fixture';

const worklogSpan = WORKLOG.span ?? UNNAMED;

const line = (action: PendingAction, options: { text: string; where: string }) => html`
  <li class="queue-line" data-action="${action.id}" tabindex="0">
    <span class="queue-source">${action.client}</span>
    <span class="queue-text">${options.text}</span>
    <span class="queue-where muted">${options.where}</span>
    ${action.humanOnly && html`<span class="et-color--warning one-by-one">One by one</span>`}
    <span class="decide">
      <button class="icon-button" data-approve type="button" title="Approve: ${action.describe}">✓</button>
      <button class="icon-button" type="button" title="Reject: ${action.describe}">✕</button>
    </span>
  </li>
`;

const dot = html`<span class="et-color--brand pending-dot"></span>`;

export default drawing({
  body: dayView({
    underHeader: html`
      <section class="et-color--brand queue">
        <div class="queue-head">
          <span class="queue-title">3 wait for you</span>
          <span class="muted">hover one to find it on the day</span>
          <button class="approve-all" type="button">Approve all (${approvableByAll})</button>
        </div>
        <ul class="queue-list">
          ${line(CREATE, {
            text: `File ${CREATE_DRAFT.projectKey}: ${CREATE_DRAFT.summary}`,
            where: `names ${span(UNNAMED)}`,
          })}
          ${line(WORKLOG, {
            text: `Log ${duration(worklogSpan.toMin - worklogSpan.fromMin)} on ${CODE_ROW.ticket}`,
            where: `${clock(worklogSpan.fromMin)} · ${WORKLOG_DETAIL}`,
          })}
          ${line(SYNC, { text: `Write ${SYNC_DAY_LABEL} to Tempo`, where: 'not on this day' })}
        </ul>
      </section>
    `,
    code: html`
      ${band({
        tone: 'success',
        fromMin: CODE_ROW.fromMin,
        toMin: CODE_ROW.toMin,
        label: `${CODE_ROW.ticket} · ${duration(CODE_ROW.toMin - CODE_ROW.fromMin)}`,
        detail: CODE_ROW.detail,
        attrs: 'data-target="worklog"',
        inner: dot,
      })}
      ${band({
        tone: 'warning',
        fromMin: UNNAMED.fromMin,
        toMin: UNNAMED.toMin,
        label: `Not yet named · ${duration(UNNAMED.toMin - UNNAMED.fromMin)}`,
        attrs: 'data-target="create"',
        inner: dot,
      })}
    `,
    calls: band({
      tone: 'success',
      fromMin: CALL_ROW.fromMin,
      toMin: CALL_ROW.toMin,
      label: `${CALL_ROW.ticket} · ${duration(CALL_ROW.toMin - CALL_ROW.fromMin)}`,
      detail: CALL_ROW.detail,
    }),
  }),
  styles:
    DAY_STYLES +
    css`
      .queue {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 0.8rem 1rem;
        border: 1px solid color-mix(in srgb, var(--et-tone-text-rest) 50%, transparent);
        border-radius: 0.4rem;
        background: color-mix(in srgb, var(--et-tone-fill-rest) 6%, transparent);
      }

      .queue-head {
        display: flex;
        align-items: baseline;
        gap: 1rem;
      }

      .queue-title {
        color: var(--color-et-tone-brand-text);
      }

      .approve-all {
        margin-left: auto;
        padding: 0.3rem 1rem;
        border: 1px solid var(--et-tone-text-rest);
        border-radius: 0.3rem;
        background: color-mix(in srgb, var(--et-tone-fill-rest) 20%, transparent);
        color: var(--color-et-tone-brand-text);
        cursor: pointer;
      }

      .queue-list {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .queue-line {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.3rem 0.6rem;
        border-radius: 0.3rem;
        outline: none;
        transition: background-color 150ms ease;
      }

      .queue-line:hover,
      .queue-line:focus-within {
        background: color-mix(in srgb, var(--et-tone-fill-rest) 14%, transparent);
      }

      .queue-source {
        width: 8.4rem;
        flex-shrink: 0;
        color: var(--et-surface-text-muted);
        white-space: nowrap;
      }

      .queue-text {
        flex-shrink: 0;
        white-space: nowrap;
      }

      .queue-where {
        flex-grow: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .decide {
        display: inline-flex;
        gap: 0.4rem;
      }

      .queue .icon-button {
        width: 2rem;
        height: 2rem;
      }

      .pending-dot {
        position: absolute;
        top: 0.7rem;
        right: 0.7rem;
        width: 0.8rem;
        height: 0.8rem;
        border-radius: 999px;
        background: var(--color-et-tone-brand-text);
      }

      .band {
        transition: opacity 150ms ease;
      }

      .band[data-target]::after {
        content: '';
        pointer-events: none;
        position: absolute;
        inset: 0;
        border: 1px solid var(--color-et-tone-brand-text);
        border-radius: inherit;
        opacity: 0;
        transition: opacity 150ms ease;
      }

      .sheet:has([data-action='create']:is(:hover, :focus-within)) [data-target='create']::after,
      .sheet:has([data-action='worklog']:is(:hover, :focus-within)) [data-target='worklog']::after {
        opacity: 1;
      }

      .sheet:has(.queue-line:is(:hover, :focus-within)) .band:not([data-target]),
      .sheet:has([data-action='create']:is(:hover, :focus-within)) .band[data-target='worklog'],
      .sheet:has([data-action='worklog']:is(:hover, :focus-within)) .band[data-target='create'],
      .sheet:has([data-action='sync']:is(:hover, :focus-within)) .band {
        opacity: 0.45;
      }
    `,
});
