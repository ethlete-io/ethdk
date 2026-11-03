export const STUDIO_E2E = 'apps/ethlete-studio/e2e';

export const STUDIO_MAP = [
  { glob: 'apps/ethlete-studio/e2e/*.e2e.mjs', suites: 'self' },
  { glob: 'apps/ethlete-studio/src/app/components/design-canvas/**', suites: ['canvas'] },
  { glob: 'apps/ethlete-studio/src/app/system-view/comment-*.ts', suites: ['canvas'] },
  { glob: 'apps/ethlete-studio/src/app/system-view/sketch-view.component.ts', suites: ['canvas', 'sketches-tree'] },
  { glob: 'apps/ethlete-studio/src/app/system-view/system-view.component.ts', suites: ['canvas', 'page-switch'] },
  { glob: 'apps/ethlete-studio/src/app/system-view/page-shell.ts', suites: ['page-switch', 'studio-menu'] },
  { glob: 'apps/ethlete-studio/src/app/design-parts/sketches/**', suites: ['sketches-tree'] },
  { glob: 'apps/ethlete-studio/src/app/studio-view/**', suites: ['page-switch', 'studio-menu'] },
  { glob: 'apps/ethlete-studio/src/app/app.*.ts', suites: ['page-switch', 'studio-menu'] },
  { glob: 'apps/ethlete-studio/src/app/components/**', suites: ['studio-menu'] },
  { glob: 'apps/ethlete-studio/src/host/design-server-pid.ts', suites: ['server-restart'] },
  { glob: 'apps/ethlete-studio/src/host/design.ts', suites: ['server-restart', 'frame-load-failed', 'canvas'] },
  { glob: 'apps/ethlete-studio/src/host/design-events.ts', suites: ['server-restart'] },
  { glob: 'apps/ethlete-studio/src/host/window.ts', suites: ['studio-menu'] },
];

export const COMPONENTS_GLOB = 'libs/components/**';

const escape = (text) => text.replace(/[.+^${}()|[\]\\]/g, '\\$&');

export const globToRegExp = (glob) =>
  new RegExp(
    `^${glob
      .split('**')
      .map((part) => escape(part).replace(/\*/g, '[^/]*'))
      .join('.*')}$`,
  );

const SPEC = /\.spec\.[cm]?[jt]s$/;

export const mapChanged = (files) => {
  const suites = new Set();
  const components = [];
  const uncovered = [];

  for (const file of files) {
    if (globToRegExp(COMPONENTS_GLOB).test(file) && !SPEC.test(file)) {
      components.push(file);
      continue;
    }

    const entries = SPEC.test(file) ? [] : STUDIO_MAP.filter((entry) => globToRegExp(entry.glob).test(file));
    if (!entries.length) {
      uncovered.push(file);
      continue;
    }

    for (const entry of entries) {
      if (entry.suites === 'self') suites.add(file.split('/').pop().replace('.e2e.mjs', ''));
      else entry.suites.forEach((suite) => suites.add(suite));
    }
  }

  return { suites: [...suites].sort(), components, uncovered };
};
