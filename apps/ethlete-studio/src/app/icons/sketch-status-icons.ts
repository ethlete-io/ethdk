import { IconDefinition } from '@ethlete/components';

export type SketchBadgeStatus =
  | 'drawing'
  | 'waiting'
  | 'paused'
  | 'failed'
  | 'merging'
  | 'autoMerge'
  | 'awaitingApproval'
  | 'awaitingSubParts'
  | 'approved';

const stroked = (name: string, paths: string): IconDefinition => ({
  name,
  data: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`,
});

export const SKETCH_STATUS_ICONS: Record<SketchBadgeStatus, IconDefinition> = {
  drawing: stroked('sk-status-drawing', '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  waiting: stroked(
    'sk-status-waiting',
    '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  ),
  awaitingApproval: stroked(
    'sk-status-awaiting-approval',
    '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  ),
  awaitingSubParts: stroked(
    'sk-status-awaiting-sub-parts',
    '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  ),
  approved: stroked('sk-status-approved', '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>'),
  paused: stroked(
    'sk-status-paused',
    '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  ),
  failed: stroked(
    'sk-status-failed',
    '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ),
  merging: stroked(
    'sk-status-merging',
    '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 9v12"/><path d="M6 9a9 9 0 0 0 9 9"/>',
  ),
  autoMerge: stroked('sk-status-auto-merge', '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>'),
};

export const SKETCH_STATUS_TONE: Record<SketchBadgeStatus, string> = {
  drawing: 'text-(--et-tone-fill) animate-pulse',
  waiting: 'text-(--et-tone-fill)',
  awaitingApproval: 'text-(--et-tone-fill)',
  awaitingSubParts: 'text-et-surface-text-muted',
  approved: 'text-et-surface-text',
  paused: 'text-et-surface-text-muted',
  failed: 'text-(--et-tone-fill)',
  merging: 'text-(--et-tone-fill) animate-pulse',
  autoMerge: 'text-(--et-tone-fill)',
};
