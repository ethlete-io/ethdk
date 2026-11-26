import { computed } from '@angular/core';
import { defineRootProvider, toInjectFn } from '@ethlete/core';
import { withWorktreeLinks } from '@ethlete/timetrack';
import { injectGitCollector } from '../collectors/git-collector';
import { injectTimetrackSettings } from './settings/settings';

/**
 * The project links every matcher reads: the ones in settings, and one for each linked worktree of a
 * linked checkout. The settings list still shows and edits only the user's own.
 */
const PROJECT_LINKS_DEF = /* @__PURE__ */ defineRootProvider(() => {
  const settings = injectTimetrackSettings();
  const git = injectGitCollector();

  return computed(() => withWorktreeLinks({ links: settings.settings().projectLinks, worktrees: git.worktrees() }));
});

export const injectProjectLinks = /* @__PURE__ */ toInjectFn(PROJECT_LINKS_DEF);
