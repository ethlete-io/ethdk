import { css, drawing, html } from '@design-explore';
import { band, DAY_STYLES, dayView } from './day';
import {
  CALL_ROW,
  CODE_ROW,
  CREATE,
  CREATE_DRAFT,
  duration,
  remAt,
  remFor,
  span,
  SYNC,
  SYNC_DAY_LABEL,
  UNNAMED,
  WORKLOG,
  WORKLOG_DETAIL,
} from './fixture';

const worklogSpan = WORKLOG.span ?? UNNAMED;

const decide = (what: string) => html`
  <span class="decide">
    <button class="icon-button" data-approve type="button" title="Approve: ${what}">✓</button>
    <button class="icon-button" type="button" title="Reject: ${what}">✕</button>
  </span>
`;

const card = (options: {
  topRem: number;
  source: string;
  title: string;
  describe: string;
  body: string;
  badge?: string;
}) => html`
  <div class="card" style="top: ${options.topRem}rem">
    <div class="card-head">
      <span class="card-source">${options.source} · ${options.title}</span>
      ${options.badge ?? ''} ${decide(options.describe)}
    </div>
    ${options.body}
  </div>
`;

const marker = (range: { fromMin: number; toMin: number }) => html`
  <span
    class="marker"
    style="top: ${remAt(range.fromMin)}rem; height: ${remFor(range.toMin - range.fromMin)}rem"
  ></span>
`;

const pending = (range: { fromMin: number; toMin: number }) => html`
  <span
    class="et-color--brand pending-edge"
    style="top: ${remAt(range.fromMin)}rem; height: ${remFor(range.toMin - range.fromMin)}rem"
  ></span>
`;

export default drawing({
  body: dayView({
    code: html`
      ${band({
        tone: 'success',
        fromMin: CODE_ROW.fromMin,
        toMin: CODE_ROW.toMin,
        label: `${CODE_ROW.ticket} · ${duration(CODE_ROW.toMin - CODE_ROW.fromMin)}`,
        detail: CODE_ROW.detail,
      })}
      ${band({
        tone: 'warning',
        fromMin: UNNAMED.fromMin,
        toMin: UNNAMED.toMin,
        label: `Not yet named · ${duration(UNNAMED.toMin - UNNAMED.fromMin)}`,
      })}
      ${pending(worklogSpan)} ${pending(UNNAMED)}
    `,
    calls: band({
      tone: 'success',
      fromMin: CALL_ROW.fromMin,
      toMin: CALL_ROW.toMin,
      label: `${CALL_ROW.ticket} · ${duration(CALL_ROW.toMin - CALL_ROW.fromMin)}`,
      detail: CALL_ROW.detail,
    }),
    autoLane: html`
      ${marker(worklogSpan)} ${marker(UNNAMED)}
      ${card({
        topRem: 0.4,
        source: SYNC.client,
        title: `Tempo · ${SYNC_DAY_LABEL}`,
        describe: SYNC.describe,
        badge: html`<span class="et-color--warning one-by-one">One by one</span>`,
        body: html`<span class="card-line muted">Writes the ${SYNC_DAY_LABEL} plan to Tempo · not on this day</span>`,
      })}
      ${card({
        topRem: remAt(worklogSpan.toMin) - 5.4,
        source: WORKLOG.client,
        title: 'New row',
        describe: WORKLOG.describe,
        body: html`
          <span class="card-line" title="${WORKLOG_DETAIL}">
            <span class="diff-add">+</span> ${CODE_ROW.ticket} · ${duration(worklogSpan.toMin - worklogSpan.fromMin)} ·
            <span class="muted">${span(worklogSpan)}</span>
          </span>
        `,
      })}
      ${card({
        topRem: remAt(UNNAMED.fromMin) + 0.2,
        source: CREATE.client,
        title: `New ${CREATE_DRAFT.projectKey} issue`,
        describe: CREATE.describe,
        body: html`
          <span class="card-line card-summary">${CREATE_DRAFT.summary}</span>
          <span class="card-line diff">
            <span class="diff-del">Not yet named</span> → <span class="diff-new">FIP-··· new</span>
            <span class="muted">· ${span(UNNAMED)}</span>
          </span>
          <details class="card-details">
            <summary>Show details</summary>
            <p>Under ${CREATE_DRAFT.parentKey} ${CREATE_DRAFT.parentSummary}. ${CREATE_DRAFT.description}</p>
          </details>
        `,
      })}
    `,
  }),
  styles:
    DAY_STYLES +
    css`
      .lane-auto .lane-head {
        color: var(--color-et-brand-ink);
      }

      .lane-auto .lane {
        background: rgb(var(--et-color-primary) / 0.04);
      }

      .pending-edge {
        pointer-events: none;
        position: absolute;
        right: -0.1rem;
        width: 0.3rem;
        border-radius: 0.2rem;
        background: var(--color-et-brand-ink);
      }

      .marker {
        position: absolute;
        left: -0.1rem;
        width: 0.3rem;
        border-radius: 0.2rem;
        background: var(--color-et-brand-ink);
      }

      .card {
        position: absolute;
        inset-inline: 0.6rem;
        z-index: 11;
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0.5rem 0.8rem 0.6rem;
        border: 1px solid rgb(var(--et-color-primary-ink) / 0.6);
        border-radius: 0.4rem;
        background: rgb(var(--et-surface-background));
        line-height: 1.4;
      }

      .card-head {
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .card-source {
        flex-grow: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--color-et-brand-ink);
      }

      .decide {
        display: inline-flex;
        gap: 0.4rem;
      }

      .card .icon-button {
        width: 2rem;
        height: 2rem;
      }

      .card-line {
        display: block;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .card-summary {
        white-space: normal;
      }

      .diff {
        font-size: 1.2rem;
      }

      .diff-del {
        color: rgb(var(--et-surface-color-subtle));
        text-decoration: line-through;
      }

      .diff-add,
      .diff-new {
        color: var(--color-et-brand-ink);
      }

      .card-details summary {
        width: fit-content;
        color: rgb(var(--et-surface-color-muted));
        font-size: 1.2rem;
        cursor: pointer;
      }

      .card-details summary:hover {
        color: rgb(var(--et-surface-color));
      }

      .card-details p {
        margin: 0.4rem 0 0;
        color: rgb(var(--et-surface-color-muted));
        white-space: normal;
      }
    `,
});
