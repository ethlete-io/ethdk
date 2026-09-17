import { css, drawing, html } from '@design-explore';
import { MINUTES } from './fixture';

const HOUR_REM = 8;
const LABEL_MIN_REM = 2.2;
const DETAIL_MIN_REM = 5;

const LABEL = 'ET-772';
const DETAIL = 'feat(repo): Answer the parent with the epic';

const band = (minutes: number) => {
  const heightRem = (minutes / 60) * HOUR_REM;
  const labelled = heightRem >= LABEL_MIN_REM - 0.3;
  const compact = heightRem < LABEL_MIN_REM;
  const detailed = heightRem >= DETAIL_MIN_REM;

  return html`
    <div
      class="et-color--success flex w-full cursor-grab flex-col overflow-hidden rounded-sm border-l-2 border-l-et-theme bg-et-theme/15 px-2 py-1 text-left text-small outline-none hover:bg-et-theme/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-et-theme-ink data-[compact]:py-0 data-[compact]:leading-none"
      style="height: ${heightRem}rem"
      ${compact && 'data-compact'}
      tabindex="0"
    >
      ${labelled && html`<span class="block truncate">${LABEL}</span>`}
      ${detailed && html`<span class="block truncate text-et-surface-muted">${DETAIL}</span>`}
    </div>
  `;
};

export default drawing({
  body: html`
    <div class="et-surface--dark flex items-start gap-4 bg-et-surface-bg p-10 text-et-surface">
      ${MINUTES.map(
        (m) => html`
          <div class="flex w-56 flex-col gap-2">
            <span class="text-mono text-et-surface-subtle">${m}m</span>
            <div class="rounded-sm border-l border-et-surface-border bg-et-surface-bg p-1">${band(m)}</div>
          </div>
        `,
      )}
    </div>
  `,
  styles: css``,
});
