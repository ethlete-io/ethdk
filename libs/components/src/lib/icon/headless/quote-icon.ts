import { IconDefinition } from './icon-provider';

// Two filled quotation marks - the block-quote tool's mark, drawn rather than typeset so it doesn't
// depend on the font's glyph.
export const QUOTE_ICON: IconDefinition = {
  name: 'et-quote',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 6.5C7 7.5 5.5 10 5.5 13v4.5h5V12H8c0-2 .7-3.3 2-4zm9 0c-3 1-4.5 3.5-4.5 6.5v4.5h5V12H17c0-2 .7-3.3 2-4z"
        fill="currentColor"
      />
    </svg>
  `,
};
