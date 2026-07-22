import { Component, output, ViewEncapsulation } from '@angular/core';

/**
 * The floating toggle button for the query devtools. Rendered with `ShadowDom` encapsulation so the
 * host application's global CSS (Tailwind resets, button styles, …) can never touch it and its own
 * styles can never leak out. Uses px (not rem) internally so it doesn't depend on the host's root
 * font-size; theme accent colour is read from an inherited custom property with a fallback.
 */
@Component({
  selector: 'et-query-devtools-toggle',
  template: `
    <button (click)="openChange.emit()" type="button" title="Toggle query devtools (Ctrl/Cmd + Alt + Q)">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7.5" ry="3" />
        <path d="M4.5 6v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" />
        <path d="M4.5 12v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
      </svg>
      <span class="label">Query</span>
    </button>
  `,
  // Shadow DOM is intentional: this always-visible floating button must be fully isolated from the
  // host app's global CSS (resets, Tailwind, button styles), which the rest of the panel can't be.
  // eslint-disable-next-line ethlete/require-view-encapsulation-none
  encapsulation: ViewEncapsulation.ShadowDom,
  styles: `
    :host {
      position: fixed;
      inset-block-end: 16px;
      inset-inline-end: 16px;
      z-index: 2147483001;
    }

    button {
      --_accent: var(--et-theme-color-primary-solid, #60a5fa);

      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px 10px 14px;
      border: none;
      border-radius: 999px;
      background: linear-gradient(135deg, #1f1f23, #2a2a30);
      color: #fafafa;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.02em;
      cursor: pointer;
      box-shadow:
        0 6px 20px rgb(0 0 0 / 0.35),
        inset 0 0 0 1px rgb(255 255 255 / 0.08);
      transition:
        transform 0.15s ease,
        box-shadow 0.2s ease;
    }

    /* Gradient accent ring via a masked pseudo-element. */
    button::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: 1px;
      background: linear-gradient(135deg, var(--_accent), transparent 60%);
      -webkit-mask:
        linear-gradient(#000 0 0) content-box,
        linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      opacity: 0.7;
      transition: opacity 0.2s ease;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow:
        0 10px 28px rgb(0 0 0 / 0.4),
        0 0 0 4px color-mix(in srgb, var(--_accent) 22%, transparent),
        inset 0 0 0 1px rgb(255 255 255 / 0.1);
    }

    button:hover::before {
      opacity: 1;
    }

    svg {
      inline-size: 16px;
      block-size: 16px;
      fill: none;
      stroke: var(--_accent);
      stroke-width: 1.6;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .label {
      line-height: 1;
    }
  `,
})
export class QueryDevtoolsToggleComponent {
  public openChange = output<void>();
}
