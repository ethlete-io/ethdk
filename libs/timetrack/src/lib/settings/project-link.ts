import { normalizeLinkPath } from '../model/link-path';
import { TimetrackProjectLink, issueKeysInText } from '../model/project-link';
import { TimetrackSettings } from './model';

const pathOf = (link: Pick<TimetrackProjectLink, 'path'>) => normalizeLinkPath(link.path);

/**
 * Puts a link into the settings, replacing whatever named the same path before. One path holds one
 * answer: a path that was both private and linked to a project would leave which one wins to the
 * order the two were written in, and the user could not see which had.
 */
export const withProjectLink = (options: {
  settings: TimetrackSettings;
  link: TimetrackProjectLink;
}): TimetrackSettings => {
  const { settings, link } = options;
  const path = pathOf(link);

  return {
    ...settings,
    projectLinks: [...settings.projectLinks.filter((entry) => pathOf(entry) !== path), link],
  };
};

export const withoutProjectLink = (options: { settings: TimetrackSettings; id: string }): TimetrackSettings => ({
  ...options.settings,
  projectLinks: options.settings.projectLinks.filter((entry) => entry.id !== options.id),
});

/** Names the epics of a project link. A private link and an unknown id change nothing. */
export const withProjectLinkEpics = (options: {
  settings: TimetrackSettings;
  id: string;
  epicKeys: readonly string[];
}): TimetrackSettings => ({
  ...options.settings,
  projectLinks: options.settings.projectLinks.map((link) => {
    if (link.id !== options.id || link.target.kind !== 'project') return link;

    const epicKeys = issueKeysInText(options.epicKeys.join(' '));

    return {
      ...link,
      target: { kind: 'project', projectKey: link.target.projectKey, ...(epicKeys.length ? { epicKeys } : {}) },
    };
  }),
});
