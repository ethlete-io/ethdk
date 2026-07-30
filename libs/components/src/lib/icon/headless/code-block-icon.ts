import { IconDefinition } from './icon-provider';

// Custom icon: the inline-code chevrons inside a block, so it reads as a fenced block next to
// `et-code` (the inline mark) in the same toolbar.
export const CODE_BLOCK_ICON: IconDefinition = {
  name: 'et-code-block',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
      <path d="M6.75 6.5 5 8l1.75 1.5" />
      <path d="M9.25 6.5 11 8 9.25 9.5" />
    </svg>
  `,
};
