import { Component, ViewEncapsulation } from '@angular/core';

/**
 * The wordmark, in place of the app's name.
 *
 * The glyph is a clock first and a cat second: the ears sit behind the ring and the tail leaves as the
 * underline, so it reads as a clock at a glance. `textLength` is what keeps the word inside the viewBox
 * on a machine whose `system-ui` is wider than the one it was drawn on.
 */
@Component({
  selector: 'ethlete-logo',
  template: `
    <svg [attr.aria-label]="'Timetrack'" class="block w-full" viewBox="7 4 193 42" role="img">
      <defs>
        <linearGradient id="et-logo-ink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0.9" />
          <stop offset="0.35" stop-color="var(--color-et-brand-ink)" />
          <stop offset="1" stop-color="var(--color-et-brand-active)" />
        </linearGradient>
      </defs>

      <path d="M13.1 15.1 L10 5.6 L19.4 11.5 Z M32.9 15.1 L36 5.6 L26.6 11.5 Z" fill="var(--color-et-brand-disabled)" />

      <path
        d="M33 32 C46 42 120 47 196 38"
        stroke="var(--color-et-brand-disabled)"
        stroke-width="2.5"
        stroke-linecap="round"
        fill="none"
      />

      <circle cx="23" cy="25" r="14" stroke="var(--color-et-brand)" stroke-width="3" fill="none" />

      <path
        d="M23 25 L23 15 M23 25 L30.5 27.5"
        stroke="var(--color-et-brand-ink)"
        stroke-width="2.5"
        stroke-linecap="round"
        fill="none"
      />

      <circle cx="23" cy="25" r="1.8" fill="var(--color-et-brand-ink)" />

      <path
        d="M41 6 L42.4 9.6 L46 11 L42.4 12.4 L41 16 L39.6 12.4 L36 11 L39.6 9.6 Z"
        fill="var(--color-et-warning-ink)"
      />

      <g transform="translate(48.5 36.5) skewX(-8)" fill="var(--color-et-brand-disabled)">
        <text x="0" y="0" font-size="26" font-weight="800" textLength="148" lengthAdjust="spacingAndGlyphs">
          TIMETRACK
        </text>
      </g>

      <g
        transform="translate(46 34) skewX(-8)"
        fill="url(#et-logo-ink)"
        stroke="var(--color-et-brand-active)"
        stroke-width="0.7"
      >
        <text x="0" y="0" font-size="26" font-weight="800" textLength="148" lengthAdjust="spacingAndGlyphs">
          TIMETRACK
        </text>
      </g>
    </svg>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block' },
})
export class LogoComponent {}
