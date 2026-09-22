import { css, drawing, html } from '@design-explore';
import { desktopRow } from './desktop';
import { phoneRow } from './phone';

/**
 * Both drawings are written as whole pages, so their class names collide. Each stylesheet is
 * prefixed with the pane that holds it before the two are joined.
 */
const scope = (pane: string, styles: string) =>
  styles.replace(/(^|\})([^{}]+)\{/g, (...match: string[]) => {
    const [, close = '', selectors = ''] = match;
    const scoped = selectors
      .split(',')
      .map((selector) => selector.trim())
      .filter(Boolean)
      .map((selector) => (selector === ':root' || selector === 'body' ? pane : `${pane} ${selector}`))
      .join(', ');

    return `${close}\n${scoped} {`;
  });

const desktop = desktopRow();
const phone = phoneRow();

/** The settled row at both widths, in one picture. */
export const review = () =>
  drawing({
    body: html`
      <div class="pane pane--desktop">${desktop.body}</div>
      <div class="pane pane--phone">${phone.body}</div>
    `,
    styles: css`
      ${scope('.pane--desktop', desktop.styles)}
      ${scope('.pane--phone', phone.styles)}

      body {
        margin: 0;
        background: #12171e;
      }

      .pane--phone {
        border-top: 1px dashed #283140;
      }
    `,
  });
