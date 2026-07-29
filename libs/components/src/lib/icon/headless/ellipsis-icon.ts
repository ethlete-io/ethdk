import { IconDefinition } from './icon-provider';

/** Horizontal three-dot glyph — the breadcrumb's "show the hidden levels" trigger. */
export const ELLIPSIS_ICON: IconDefinition = {
  name: 'et-ellipsis',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="19" cy="12" r="1.75" fill="currentColor" />
    </svg>
  `,
};
