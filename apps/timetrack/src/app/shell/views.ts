export type ShellView = {
  path: string;
  label: string;
  /** One line under the label, so the rail says what a view is for rather than only naming it. */
  hint: string;
};

export const SHELL_VIEWS: ShellView[] = [
  { path: 'day', label: 'Day', hint: 'Review and edit the reconstruction' },
  { path: 'start', label: 'Start', hint: 'A ticket, its branch and a draft merge request' },
  { path: 'week', label: 'Week', hint: 'Which days are still not finished' },
  { path: 'sync', label: 'Sync', hint: 'What would be written to Tempo' },
  { path: 'sources', label: 'Sources', hint: 'What each collector is seeing' },
  { path: 'settings', label: 'Settings', hint: 'Target, credentials, exclusions' },
  { path: 'host', label: 'Host', hint: 'The encrypted store and its cursors' },
];
