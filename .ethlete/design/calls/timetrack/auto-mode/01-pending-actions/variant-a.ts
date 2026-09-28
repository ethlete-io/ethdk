import { css, drawing, html } from '@design-explore';
import { band, DAY_STYLES, dayView } from './day';
import {
  CALL_ROW,
  CODE_ROW,
  CREATE_DRAFT,
  duration,
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

export default drawing({
  body: dayView({
    headerSide: html`
      <button class="et-color--brand pill" type="button" title="${SYNC.describe}">
        <span class="pill-dot"></span>
        1 more waiting
        <span class="pill-hint">· Tempo, ${SYNC_DAY_LABEL}</span>
      </button>
    `,
    code: html`
      ${band({
        tone: 'success',
        fromMin: CODE_ROW.fromMin,
        toMin: CODE_ROW.toMin,
        label: `${CODE_ROW.ticket} · ${duration(CODE_ROW.toMin - CODE_ROW.fromMin)}`,
        detail: CODE_ROW.detail,
      })}
      ${band({
        tone: 'brand',
        fromMin: worklogSpan.fromMin,
        toMin: worklogSpan.toMin,
        label: `+ ${duration(worklogSpan.toMin - worklogSpan.fromMin)} on ${CODE_ROW.ticket}`,
        extraClass: 'proposed',
        attrs: `title="${WORKLOG.client} · ${WORKLOG_DETAIL}"`,
        inner: html`<span class="proposed-by">${WORKLOG.client}</span>${decide(WORKLOG.describe)}`,
      })}
      ${band({
        tone: 'brand',
        fromMin: UNNAMED.fromMin,
        toMin: UNNAMED.toMin,
        label: `FIP-··· new · ${duration(UNNAMED.toMin - UNNAMED.fromMin)}`,
        detail: CREATE_DRAFT.summary,
        extraClass: 'proposed',
        attrs: `title="Was Not yet named · under ${CREATE_DRAFT.parentKey} ${CREATE_DRAFT.parentSummary}"`,
        inner: html`
          <span class="ask">
            <span class="ask-line">Auto mode · File ${CREATE_DRAFT.projectKey}: ${CREATE_DRAFT.summary}</span>
            ${decide(`File ${CREATE_DRAFT.projectKey}: ${CREATE_DRAFT.summary}`)}
          </span>
        `,
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
      .pill-hint {
        color: rgb(var(--et-surface-color-muted));
      }

      .band.proposed {
        border: 1px dashed rgb(var(--et-color-primary-ink));
        background: rgb(var(--et-color-primary) / 0.1);
        padding-block: 0.3rem;
        line-height: 1.3;
        cursor: default;
      }

      .band.proposed:not([data-compact]) > .band-line:first-child {
        color: var(--color-et-brand-ink);
      }

      .band.proposed[data-compact] {
        flex-direction: row;
        align-items: center;
        gap: 0.6rem;
        padding-inline: 0.8rem 0.2rem;
      }

      .band.proposed[data-compact] .band-line {
        flex-grow: 1;
        color: var(--color-et-brand-ink);
      }

      .proposed-by {
        color: rgb(var(--et-surface-color-muted));
        font-size: 1.2rem;
        white-space: nowrap;
      }

      .proposed .icon-button {
        width: 1.8rem;
        height: 1.8rem;
      }

      .decide {
        display: inline-flex;
        gap: 0.4rem;
      }

      .ask {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        margin-top: auto;
        padding-top: 0.2rem;
        border-top: 1px dashed rgb(var(--et-color-primary-ink) / 0.5);
      }

      .ask-line {
        flex-grow: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: var(--color-et-brand-ink);
      }
    `,
});
