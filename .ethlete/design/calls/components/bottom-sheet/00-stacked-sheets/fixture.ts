import { themeCss } from '@ethlete/core/design/theme-css';
import { css, html } from '@design-explore';
import { COLOR_THEMES, SURFACE_THEMES } from '../../themes';

export const PHONE = html`<div class="phone">
  <div class="page">
    <p class="page-title">Matches</p>
    <div class="row"></div>
    <div class="row"></div>
    <div class="row"></div>
    <div class="row"></div>
  </div>
  <div class="scrim scrim--page"></div>
  <section class="sheet sheet--first">
    <span class="handle"></span>
    <p class="sheet-title">Filter</p>
    <div class="row"></div>
    <div class="row"></div>
    <button class="action" type="button" data-open>Choose a date</button>
    <div class="scrim scrim--sheet"></div>
  </section>
  <section class="sheet sheet--second">
    <span class="handle"></span>
    <p class="sheet-title">Date</p>
    <div class="row"></div>
    <div class="row"></div>
    <button class="action" type="button" data-close>Done</button>
  </section>
</div>`;

export const SPRING =
  'linear(0, 0.009, 0.035 2.1%, 0.141 4.4%, 0.723 15.5%, 0.938 20.7%, 1.017 24.3%, 1.061 27.9%, 1.071 31.6%, 1.061 35.6%, 1.017 45.3%, 0.997 53.4%, 0.994 60.6%, 1)';

export function stackOnClick(root: HTMLElement) {
  const phone = root.querySelector<HTMLElement>('.phone');
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-open]')) phone?.setAttribute('data-stacked', '');
    if (target.closest('[data-close]')) phone?.removeAttribute('data-stacked');
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
    block-size: 48px;
    margin-block-end: 12px;
    border-radius: 12px;
    background: var(--et-surface-border-solid);
    opacity: 0.6;
  }
  .scrim {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.4);
    pointer-events: none;
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
    transition:
      transform 400ms ${SPRING},
      border-radius 400ms ${SPRING};
  }
  .sheet--first {
    inset-block-start: 56px;
  }
  .sheet--second {
    inset-block-start: 66px;
    transform: translateY(100%);
  }
  .phone[data-stacked] .sheet--second {
    transform: none;
  }
  .scrim--sheet {
    opacity: 0;
    transition: opacity 300ms ease-out;
  }
  .handle {
    display: block;
    inline-size: 32px;
    block-size: 4px;
    margin: 10px auto 22px;
    border-radius: 5px;
    background: var(--et-surface-border-solid);
  }
  .action {
    margin-block-start: 8px;
    padding: 12px 20px;
    border: 0;
    border-radius: 10px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    background: var(--et-theme-color-primary-color-default, rgb(37 99 235));
    color: var(--et-theme-color-primary-on-color-default, white);
  }
`;
