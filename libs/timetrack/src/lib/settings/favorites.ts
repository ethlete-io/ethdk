import { projectKeyOf } from '../ticket/project';
import { TimetrackFavoriteProject, TimetrackSettings } from './model';

const normalizeKey = (key: string) => key.trim().toUpperCase();

/** The keys of the projects the user picked, in the order they were picked. */
export const favoriteProjectKeys = (settings: Pick<TimetrackSettings, 'favoriteProjects'>) =>
  settings.favoriteProjects.map((project) => project.key);

/**
 * Whether an issue key belongs to a project the user picked. Nothing is a favourite while the list is
 * empty: an unconfigured list is the absence of a statement, not a statement about everything.
 */
export const isFavoriteIssueKey = (options: {
  issueKey: string;
  settings: Pick<TimetrackSettings, 'favoriteProjects'>;
}) => {
  const project = projectKeyOf(options.issueKey);

  return !!project && favoriteProjectKeys(options.settings).includes(project);
};

/** Reads a picked project into the shape the document holds, or nothing when it names no key. */
export const toFavoriteProject = (project: { key: string; name?: string }): TimetrackFavoriteProject | undefined => {
  const key = normalizeKey(project.key);

  return key ? { key, name: project.name?.trim() || key } : undefined;
};

/**
 * Replaces the favourites with what a picker chose, keeping its order and dropping a key listed twice.
 * The order is the user's: it is what every project list in the app is shown in.
 */
export const withFavoriteProjects = (options: {
  settings: TimetrackSettings;
  projects: readonly { key: string; name?: string }[];
}): TimetrackSettings => {
  const found = new Map<string, TimetrackFavoriteProject>();

  for (const project of options.projects) {
    const favorite = toFavoriteProject(project);

    if (favorite && !found.has(favorite.key)) found.set(favorite.key, favorite);
  }

  return { ...options.settings, favoriteProjects: [...found.values()] };
};

export const withoutFavoriteProject = (options: { settings: TimetrackSettings; key: string }): TimetrackSettings => ({
  ...options.settings,
  favoriteProjects: options.settings.favoriteProjects.filter((project) => project.key !== normalizeKey(options.key)),
});
