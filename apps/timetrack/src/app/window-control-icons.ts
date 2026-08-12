import { IconDefinition } from '@ethlete/components';

export const MAXIMIZE_ICON: IconDefinition = {
  name: 'timetrack-maximize',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <rect
        x="3.25"
        y="3.25"
        width="9.5"
        height="9.5"
        rx="1.25"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
      />
    </svg>
  `,
};

export const RESTORE_ICON: IconDefinition = {
  name: 'timetrack-restore',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
      <path d="M5.25 5.25V4.25A1.25 1.25 0 0 1 6.5 3h5.25A1.25 1.25 0 0 1 13 4.25V9.5a1.25 1.25 0 0 1-1.25 1.25h-1"
        fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      <rect
        x="3"
        y="5.25"
        width="7.75"
        height="7.75"
        rx="1.25"
        fill="none"
        stroke="currentColor"
        stroke-width="1.3"
      />
    </svg>
  `,
};
