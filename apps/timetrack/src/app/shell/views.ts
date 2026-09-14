export type ShellView = {
  path: string;
  label: string;
  /** One line under the label, so the rail says what a view is for rather than only naming it. */
  hint: string;
};

export const SHELL_VIEWS: ShellView[] = [
  { path: 'day', label: 'Day', hint: 'The timeline of what was worked on, and what to log for it' },
  { path: 'sources', label: 'Sources', hint: 'What each collector is seeing' },
  { path: 'settings', label: 'Settings', hint: 'Target, credentials, exclusions' },
  { path: 'host', label: 'Host', hint: 'The encrypted store and its cursors' },
];
