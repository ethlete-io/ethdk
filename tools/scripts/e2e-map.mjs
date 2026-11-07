export const STUDIO_E2E = 'apps/ethlete-studio/e2e';

export const CANVAS_VIEWS = ['system', 'sketches', 'flow'];
const canvas = (...views) => views.map((view) => `canvas-${view}`);
const ALL_CANVAS = canvas(...CANVAS_VIEWS);

export const suiteInvocation = (suite) => {
  const view = /^canvas-(.+)$/.exec(suite)?.[1];

  return view
    ? { script: `${STUDIO_E2E}/canvas.e2e.mjs`, args: ['--view', view] }
    : { script: `${STUDIO_E2E}/${suite}.e2e.mjs`, args: [] };
};

export const STUDIO_MAP = [
  { glob: 'apps/ethlete-studio/e2e/*.e2e.mjs', suites: 'self' },
  { glob: 'apps/ethlete-studio/src/app/components/design-canvas/**', suites: ALL_CANVAS },
  { glob: 'apps/ethlete-studio/src/app/system-view/comment-*.ts', suites: canvas('system', 'sketches') },
  {
    glob: 'apps/ethlete-studio/src/app/system-view/sketch-view.component.ts',
    suites: [...canvas('sketches'), 'sketches-tree'],
  },
  {
    glob: 'apps/ethlete-studio/src/app/system-view/system-view.component.ts',
    suites: [...canvas('system'), 'page-switch'],
  },
  { glob: 'apps/ethlete-studio/src/app/system-view/page-shell.ts', suites: ['page-switch', 'studio-menu'] },
  { glob: 'apps/ethlete-studio/src/app/design-parts/sketches/**', suites: [...canvas('sketches'), 'sketches-tree'] },
  { glob: 'apps/ethlete-studio/src/app/system-view/flow-*.ts', suites: canvas('flow') },
  { glob: 'apps/ethlete-studio/src/app/system-view/**', suites: ALL_CANVAS, fallback: true },
  { glob: 'apps/ethlete-studio/src/app/studio-view/**', suites: ['page-switch', 'studio-menu'] },
  { glob: 'apps/ethlete-studio/src/app/app.*.ts', suites: ['page-switch', 'studio-menu'] },
  { glob: 'apps/ethlete-studio/src/app/components/**', suites: ['studio-menu'] },
  { glob: 'apps/ethlete-studio/src/host/design-server-pid.ts', suites: ['server-restart'] },
  { glob: 'apps/ethlete-studio/src/host/design.ts', suites: ['server-restart', 'frame-load-failed', ...ALL_CANVAS] },
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

    const matched = SPEC.test(file) ? [] : STUDIO_MAP.filter((entry) => globToRegExp(entry.glob).test(file));
    const specific = matched.filter((entry) => !entry.fallback);
    const entries = specific.length ? specific : matched;
    if (!entries.length) {
      uncovered.push(file);
      continue;
    }

    for (const entry of entries) {
      if (entry.suites === 'self') {
        const name = file.split('/').pop().replace('.e2e.mjs', '');
        (name === 'canvas' ? ALL_CANVAS : [name]).forEach((suite) => suites.add(suite));
      } else entry.suites.forEach((suite) => suites.add(suite));
    }
  }

  return { suites: [...suites].sort(), components, uncovered };
};
