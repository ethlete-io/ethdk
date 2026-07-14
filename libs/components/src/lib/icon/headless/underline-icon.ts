import { IconDefinition } from './icon-provider';

// Custom icon.
export const UNDERLINE_ICON: IconDefinition = {
  name: 'et-underline',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <text x="8" y="10.5" font-size="10" font-weight="700" text-anchor="middle" fill="currentColor">U</text>
      <line x1="4" y1="13.5" x2="12" y2="13.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  `,
};
