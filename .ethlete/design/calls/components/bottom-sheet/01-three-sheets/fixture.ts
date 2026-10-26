import { themeCss } from '@ethlete/core/design/theme-css';
import { css, html } from '@design-explore';
import { COLOR_THEMES, SURFACE_THEMES } from '../../themes';

const sheet = (level: number, title: string, rows: number) =>
  html`<section class="sheet sheet--${level}">
    <span class="handle"></span>
    <p class="sheet-title">${title}</p>
    ${Array.from({ length: rows }, () => html`<div class="row"></div>`).join('')}
    <div class="actions">
      ${level < 3 ? html`<button class="action" type="button" data-next>Open next</button>` : ''}
      <button class="action action--quiet" type="button" data-back>Close</button>
    </div>
  </section>`;

export const PHONE = html`<div class="phone" data-depth="1">
  <div class="page">
    <p class="page-title">Matches</p>
    <div class="row"></div>
    <div class="row"></div>
    <div class="row"></div>
  </div>
  <div class="backdrop backdrop--1"></div>
  ${sheet(1, 'Filter', 9)}
  <div class="backdrop backdrop--2"></div>
  ${sheet(2, 'Date', 7)}
  <div class="backdrop backdrop--3"></div>
  ${sheet(3, 'Time', 7)}
</div>`;

export const SPRING =
  'linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 15.5%, 0.938 20.7%, 1.017 24.3%, 1.061 27.9%, 1.071 31.6%, 1.061 35.6%, 1.017 45.3%, 0.997 53.4%, 0.994 60.6%, 1)';

export function stepOnClick(root: HTMLElement) {
  const phone = root.querySelector<HTMLElement>('.phone');
  root.addEventListener('click', (event) => {
    if (!phone) return;
    const target = event.target as HTMLElement;
    const depth = Number(phone.dataset['depth']);
    if (target.closest('[data-next]')) phone.dataset['depth'] = String(Math.min(3, depth + 1));
    if (target.closest('[data-back]')) phone.dataset['depth'] = String(Math.max(1, depth - 1));
  });
}

export const BASE = css`
  ${themeCss({ surfaceThemes: SURFACE_THEMES, colorThemes: COLOR_THEMES })}
  body {
    margin: 0;
    padding: 24px;
    font-family: system-ui, sans-serif;
    background: var(--et-surface-background-solid);
  }
  .phone {
    position: relative;
    overflow: hidden;
    inline-size: 360px;
    block-size: 720px;
    margin-inline: auto;
    border-radius: 36px;
    border: 1px solid var(--et-surface-border-solid);
    background: var(--et-surface-background-solid);
    color: var(--et-surface-color-solid);
  }
  .page {
    padding: 56px 20px 0;
  }
  .page-title,
  .sheet-title {
    margin: 0 0 16px;
    font-size: 22px;
    font-weight: 600;
  }
  .row {
    block-size: 40px;
    margin-block-end: 12px;
    border-radius: 12px;
    background: var(--et-surface-border-solid);
    opacity: 0.6;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    opacity: 0;
    pointer-events: none;
    transition: opacity 300ms ease-out;
  }
  .sheet {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    box-sizing: border-box;
    padding: 0 20px;
    border-radius: 20px 20px 0 0;
    overflow: hidden;
    background: var(--et-surface-background-solid);
    box-shadow: 0 -1px 0 var(--et-surface-border-solid);
    transform-origin: top center;
    transform: translateY(100%);
    transition:
      transform 400ms ${SPRING},
      translate 400ms ${SPRING},
      scale 400ms ${SPRING},
      opacity 200ms ease-out;
  }
  .sheet--1 {
    inset-block-start: 40px;
  }
  .sheet--2 {
    inset-block-start: 150px;
  }
  .sheet--3 {
    inset-block-start: 160px;
  }
  .sheet--1,
  .phone:is([data-depth='2'], [data-depth='3']) .sheet--2,
  .phone[data-depth='3'] .sheet--3 {
    transform: none;
  }
  .backdrop--1,
  .phone:is([data-depth='2'], [data-depth='3']) .backdrop--2,
  .phone[data-depth='3'] .backdrop--3 {
    opacity: 1;
  }
  .handle {
    display: block;
    inline-size: 32px;
    block-size: 4px;
    margin: 10px auto 22px;
    border-radius: 5px;
    background: var(--et-surface-border-solid);
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .action {
    padding: 12px 20px;
    border: 0;
    border-radius: 10px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    background: var(--et-theme-color-primary-color-default, rgb(37 99 235));
    color: var(--et-theme-color-primary-on-color-default, white);
  }
  .action--quiet {
    background: var(--et-surface-border-solid);
    color: inherit;
  }
`;
